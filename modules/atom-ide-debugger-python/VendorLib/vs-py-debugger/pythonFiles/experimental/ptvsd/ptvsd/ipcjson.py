# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

from __future__ import print_function, with_statement, absolute_import

# This module MUST NOT import threading in global scope. This is because
# in a direct (non-ptvsd) attach scenario, it is loaded on the injected
# debugger attach thread, and if threading module hasn't been loaded
# already, it will assume that the thread on which it is being loaded is
# the main thread. This will cause issues when the thread goes away
# after attach completes.

import errno
import itertools
import json
import os
import os.path
from socket import create_connection
import sys
import time
import traceback

from .socket import TimeoutError, convert_eof


_TRACE = None

SKIP_TB_PREFIXES = [
    os.path.normcase(
        os.path.dirname(
            os.path.abspath(__file__))),
]

TIMEOUT = os.environ.get('PTVSD_SOCKET_TIMEOUT')
if TIMEOUT:
    TIMEOUT = float(TIMEOUT)


if sys.version_info[0] >= 3:
    from encodings import ascii

    def to_bytes(cmd_str):
        return ascii.Codec.encode(cmd_str)[0]
else:
    def to_bytes(cmd_str):
        return cmd_str

    class BrokenPipeError(Exception):
        pass


def _trace(*msg):
    if _TRACE:
        _TRACE(''.join(_str_or_call(m) for m in msg) + '\n')


def _str_or_call(m):
    # TODO: Use callable() here.
    try:
        call = m.__call__
    except AttributeError:
        return str(m)
    else:
        return str(call())


class InvalidHeaderError(Exception):
    # TODO: docstring
    pass


class InvalidContentError(Exception):
    # TODO: docstring
    pass


class SocketIO(object):
    # TODO: docstring

    def __init__(self, *args, **kwargs):
        port = kwargs.pop('port', None)
        socket = kwargs.pop('socket', None)
        own_socket = kwargs.pop('own_socket', True)
        logfile = kwargs.pop('logfile', None)
        if socket is None:
            if port is None:
                raise ValueError(
                    "A 'port' or a 'socket' must be passed to SocketIO initializer as a keyword argument.")  # noqa
            addr = ('127.0.0.1', port)
            socket = create_connection(addr)
            own_socket = True
        super(SocketIO, self).__init__(*args, **kwargs)

        self.__buffer = to_bytes('')
        self.__port = port
        self.__socket = socket
        self.__own_socket = own_socket
        self.__logfile = logfile

    def _send(self, **payload):
        # TODO: docstring
        content = json.dumps(payload).encode('utf-8')
        headers = ('Content-Length: {}\r\n\r\n'.format(len(content))
                   ).encode('ascii')
        # TODO: We never actually use a logfile...
        if self.__logfile is not None:
            self.__logfile.write(content)
            self.__logfile.write('\n'.encode('utf-8'))
            self.__logfile.flush()
        try:
            self.__socket.send(headers)
            self.__socket.send(content)
        except BrokenPipeError:
            pass
        except OSError as exc:
            if exc.errno in (errno.EPIPE, errno.ESHUTDOWN):  # BrokenPipeError
                pass
            elif exc.errno not in (errno.ENOTCONN, errno.EBADF):
                raise

    def _buffered_read_line_as_ascii(self):
        """Return the next line from the buffer as a string.

        Reads bytes until it encounters newline chars, and returns the bytes
        ascii decoded, newline chars are excluded from the return value.
        Blocks until: newline chars are read OR socket is closed.
        """
        newline = '\r\n'.encode('ascii')
        while newline not in self.__buffer:
            temp = self.__socket.recv(1024)
            if not temp:
                break
            self.__buffer += temp

        if not self.__buffer:
            return None

        try:
            index = self.__buffer.index(newline)
        except ValueError:
            raise InvalidHeaderError('Header line not terminated')

        line = self.__buffer[:index]
        self.__buffer = self.__buffer[index+len(newline):]
        return line.decode('ascii', 'replace')

    def _buffered_read_as_utf8(self, length):
        # TODO: docstring
        while len(self.__buffer) < length:
            temp = self.__socket.recv(1024)
            if not temp:
                break
            self.__buffer += temp

        if len(self.__buffer) < length:
            raise InvalidContentError(
                    'Expected to read {} bytes of content, but only read {} bytes.'.format(length, len(self.__buffer)))  # noqa

        content = self.__buffer[:length]
        self.__buffer = self.__buffer[length:]
        return content.decode('utf-8', 'replace')

    def _wait_for_message(self):
        # TODO: docstring
        # base protocol defined at:
        #  https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md#base-protocol

        # read all headers, ascii encoded separated by '\r\n'
        # end of headers is indicated by an empty line
        headers = {}
        line = self._buffered_read_line_as_ascii()
        while line:
            parts = line.split(':')
            if len(parts) == 2:
                headers[parts[0]] = parts[1]
            else:
                raise InvalidHeaderError(
                    "Malformed header, expected 'name: value'\n" + line)
            line = self._buffered_read_line_as_ascii()

        # end of stream
        if not line and not headers:
            return

        # validate headers
        try:
            length_text = headers['Content-Length']
            try:
                length = int(length_text)
            except ValueError:
                raise InvalidHeaderError(
                        'Invalid Content-Length: ' + length_text)
        except NameError:
            raise InvalidHeaderError('Content-Length not specified in headers')
        except KeyError:
            raise InvalidHeaderError('Content-Length not specified in headers')

        if length < 0 or length > 2147483647:
            raise InvalidHeaderError('Invalid Content-Length: ' + length_text)

        # read content, utf-8 encoded
        content = self._buffered_read_as_utf8(length)
        try:
            msg = json.loads(content)
            self._receive_message(msg)
        except ValueError:
            raise InvalidContentError('Error deserializing message content.')
        except json.decoder.JSONDecodeError:
            raise InvalidContentError('Error deserializing message content.')

    def _close(self):
        # TODO: docstring
        if self.__own_socket:
            self.__socket.close()


'''
class StandardIO(object):
    # TODO: docstring

    def __init__(self, stdin, stdout, *args, **kwargs):
        super(StandardIO, self).__init__(*args, **kwargs)
        try:
            self.__stdin = stdin.buffer
            self.__stdout = stdout.buffer
        except AttributeError:
            self.__stdin = stdin
            self.__stdout = stdout

    def _send(self, **payload):
        data = json.dumps(payload).encode('utf-8') + NEWLINE_BYTES
        self.__stdout.write(data)
        self.__stdout.flush()

    def _wait_for_message(self):
        msg = json.loads(
            self.__stdin.readline().decode('utf-8', 'replace').rstrip())
        self._receive_message(msg)

    def _close(self):
        pass
'''


class IpcChannel(object):
    # TODO: docstring

    def __init__(self, *args, **kwargs):
        timeout = kwargs.pop('timeout', None)
        if timeout is None:
            timeout = TIMEOUT
        super(IpcChannel, self).__init__(*args, **kwargs)
        # This class is meant to be last in the list of base classes
        # Don't call super because object's __init__ doesn't take arguments
        try:
            import thread
        except ImportError:
            import _thread as thread
        # TODO: switch to a single underscore for "private" variables.
        self.__seq = itertools.count()
        self.__exit = False
        self.__lock = thread.allocate_lock()
        self.__message = []
        self._timeout = timeout
        self._fail_after = None

    def close(self):
        # TODO: docstring
        self._close()

    def send_event(self, _name, **kwargs):
        # TODO: docstring
        with self.__lock:
            self._send(
                type='event',
                seq=next(self.__seq),
                event=_name,
                body=kwargs,
            )

    def send_response(self, request, success=True, message=None, **kwargs):
        # TODO: docstring
        with self.__lock:
            self._send(
                type='response',
                seq=next(self.__seq),
                request_seq=int(request.get('seq', 0)),
                success=success,
                command=request.get('command', ''),
                message=message or '',
                body=kwargs,
            )

    def set_exit(self):
        # TODO: docstring
        self.__exit = True

    def process_messages(self):
        # TODO: docstring
        if self._timeout is not None:
            self._fail_after = time.time() + self._timeout
        while not self.__exit:
            try:
                self.process_one_message()
                _trace('self.__exit is ', self.__exit)
            except Exception:
                if not self.__exit:
                    raise
                # TODO: log the error?

    def process_one_message(self):
        # TODO: docstring
        try:
            msg = self.__message.pop(0)
        except IndexError:
            with convert_eof():
                self._wait_for_message()
            try:
                msg = self.__message.pop(0)
            except IndexError:
                # No messages received.
                if self._fail_after is not None:
                    if time.time() < self._fail_after:
                        raise TimeoutError('connection closed?')
                raise EOFError('no more messages')
        if self._fail_after is not None:
            self._fail_after = time.time() + self._timeout

        _trace('Received ', msg)

        try:
            if msg['type'] == 'request':
                self.on_request(msg)
            elif msg['type'] == 'response':
                self.on_response(msg)
            elif msg['type'] == 'event':
                self.on_event(msg)
            else:
                self.on_invalid_request(msg, {})
        except AssertionError:
            raise
        except Exception:
            _trace('Error ', traceback.format_exc)
            traceback.print_exc()

    def on_request(self, request):
        # TODO: docstring
        assert request.get('type', '') == 'request', \
                "Only handle 'request' messages in on_request"

        cmd = request.get('command', '')
        args = request.get('arguments', {})
        target = getattr(self, 'on_' + cmd,
                         self.on_invalid_request)
        try:
            _trace('Calling ', repr(target))
            target(request, args)
        except AssertionError:
            raise
        except Exception:
            self.send_response(
                request,
                success=False,
                message=traceback.format_exc(),
            )

    def on_response(self, msg):
        # TODO: docstring
        # this class is only used for server side only for now
        raise NotImplementedError

    def on_event(self, msg):
        # TODO: docstring
        # this class is only used for server side only for now
        raise NotImplementedError

    def on_invalid_request(self, request, args):
        # TODO: docstring
        self.send_response(request, success=False, message='Unknown command')

    def _receive_message(self, message):
        with self.__lock:
            self.__message.append(message)
