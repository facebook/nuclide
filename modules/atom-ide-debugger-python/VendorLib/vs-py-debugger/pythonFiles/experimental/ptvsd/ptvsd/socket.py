# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

from __future__ import absolute_import

from collections import namedtuple
import contextlib
import errno
import socket
try:
    from urllib.parse import urlparse
except ImportError:
    from urlparse import urlparse


try:
    ConnectionError  # noqa
    BrokenPipeError  # noqa
    ConnectionResetError  # noqa
except NameError:
    class BrokenPipeError(Exception):
        # EPIPE and ESHUTDOWN
        pass

    class ConnectionResetError(Exception):
        # ECONNRESET
        pass


NOT_CONNECTED = (
    errno.ENOTCONN,
    errno.EBADF,
)

CLOSED = (
    errno.EPIPE,
    errno.ESHUTDOWN,
    errno.ECONNRESET,
    # Windows
    10038,  # "An operation was attempted on something that is not a socket"
    10058,
)

EOF = NOT_CONNECTED + CLOSED


@contextlib.contextmanager
def convert_eof():
    """A context manager to convert some socket errors into EOFError."""
    try:
        yield
    except ConnectionResetError:
        raise EOFError
    except BrokenPipeError:
        raise EOFError
    except OSError as exc:
        if exc.errno in EOF:
            raise EOFError
        raise


class TimeoutError(socket.timeout):
    """A socket timeout happened."""


def is_socket(sock):
    """Return True if the object can be used as a socket."""
    return isinstance(sock, socket.socket)


def create_server(host, port):
    """Return a local server socket listening on the given port."""
    if host is None:
        host = 'localhost'
    server = _new_sock()
    server.bind((host, port))
    server.listen(1)
    return server


def create_client():
    """Return a client socket that may be connected to a remote address."""
    return _new_sock()


def _new_sock():
    sock = socket.socket(socket.AF_INET,
                         socket.SOCK_STREAM,
                         socket.IPPROTO_TCP)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    return sock


@contextlib.contextmanager
def ignored_errno(*ignored):
    """A context manager that ignores the given errnos."""
    try:
        yield
    except OSError as exc:
        if exc.errno not in ignored:
            raise


class KeepAlive(namedtuple('KeepAlive', 'interval idle maxfails')):
    """TCP keep-alive settings."""

    INTERVAL = 3  # seconds
    IDLE = 1  # seconds after idle
    MAX_FAILS = 5

    @classmethod
    def from_raw(cls, raw):
        """Return the corresponding KeepAlive."""
        if raw is None:
            return None
        elif isinstance(raw, cls):
            return raw
        elif isinstance(raw, (str, int, float)):
            return cls(raw)
        else:
            try:
                raw = dict(raw)
            except TypeError:
                return cls(*raw)
            else:
                return cls(**raw)

    def __new__(cls, interval=None, idle=None, maxfails=None):
        self = super(KeepAlive, cls).__new__(
            cls,
            float(interval) if interval or interval == 0 else cls.INTERVAL,
            float(idle) if idle or idle == 0 else cls.IDLE,
            float(maxfails) if maxfails or maxfails == 0 else cls.MAX_FAILS,
        )
        return self

    def apply(self, sock):
        """Set the keepalive values on the socket."""
        sock.setsockopt(socket.SOL_SOCKET,
                        socket.SO_KEEPALIVE,
                        1)
        interval = self.interval
        idle = self.idle
        maxfails = self.maxfails
        try:
            if interval > 0:
                sock.setsockopt(socket.IPPROTO_TCP,
                                socket.TCP_KEEPINTVL,
                                interval)
            if idle > 0:
                sock.setsockopt(socket.IPPROTO_TCP,
                                socket.TCP_KEEPIDLE,
                                idle)
            if maxfails >= 0:
                sock.setsockopt(socket.IPPROTO_TCP,
                                socket.TCP_KEEPCNT,
                                maxfails)
        except AttributeError:
            # mostly linux-only
            pass


def connect(sock, addr, keepalive=None):
    """Return the client socket for the next connection."""
    if addr is None:
        if keepalive is None or keepalive is True:
            keepalive = KeepAlive()
        elif keepalive:
            keepalive = KeepAlive.from_raw(keepalive)
        client, _ = sock.accept()
        if keepalive:
            keepalive.apply(client)
        return client
    else:
        if keepalive:
            raise NotImplementedError
        sock.connect(addr)
        return sock


def shut_down(sock, how=socket.SHUT_RDWR, ignored=NOT_CONNECTED):
    """Shut down the given socket."""
    with ignored_errno(*ignored or ()):
        sock.shutdown(how)


def close_socket(sock):
    """Shutdown and close the socket."""
    try:
        shut_down(sock)
    except Exception:
        # TODO: Log errors?
        pass
    sock.close()


class Address(namedtuple('Address', 'host port')):
    """An IP address to use for sockets."""

    @classmethod
    def from_raw(cls, raw, defaultport=None):
        """Return an address corresponding to the given data."""
        if isinstance(raw, cls):
            return raw
        elif isinstance(raw, int):
            return cls(None, raw)
        elif isinstance(raw, str):
            if raw == '':
                return cls('', defaultport)
            parsed = urlparse(raw)
            if not parsed.netloc:
                if parsed.scheme:
                    raise ValueError('invalid address {!r}'.format(raw))
                return cls.from_raw('x://' + raw, defaultport=defaultport)
            return cls(
                parsed.hostname or '',
                parsed.port if parsed.port else defaultport,
            )
        elif not raw:
            return cls(None, defaultport)
        else:
            try:
                kwargs = dict(**raw)
            except TypeError:
                return cls(*raw)
            else:
                kwargs.setdefault('host', None)
                kwargs.setdefault('port', defaultport)
                return cls(**kwargs)

    @classmethod
    def as_server(cls, host, port):
        """Return an address to use as a server address."""
        return cls(host, port, isserver=True)

    @classmethod
    def as_client(cls, host, port):
        """Return an address to use as a server address."""
        return cls(host, port, isserver=False)

    def __new__(cls, host, port, **kwargs):
        if host == '*':
            host = ''
        isserver = kwargs.pop('isserver', None)
        if isserver is None:
            isserver = (host is None or host == '')
        else:
            isserver = bool(isserver)
        if host is None:
            host = 'localhost'
        self = super(Address, cls).__new__(
            cls,
            str(host),
            int(port) if port is not None else None,
            **kwargs
        )
        self._isserver = isserver
        return self

    def __init__(self, *args, **kwargs):
        if self.port is None:
            raise TypeError('missing port')
        if self.port <= 0 or self.port > 65535:
            raise ValueError('port must be positive int < 65535')

    def __repr__(self):
        orig = super(Address, self).__repr__()
        return '{}, isserver={})'.format(orig[:-1], self._isserver)

    def __eq__(self, other):
        if not super(Address, self).__eq__(other):
            return False
        try:
            other = self.from_raw(other)
        except Exception:
            return False
        return self._isserver == other._isserver

    @property
    def isserver(self):
        return self._isserver
