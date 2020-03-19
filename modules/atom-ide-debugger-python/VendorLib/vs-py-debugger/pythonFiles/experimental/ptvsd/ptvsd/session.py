# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

from .socket import is_socket, close_socket
from .wrapper import VSCodeMessageProcessor
from ._util import TimeoutError, ClosedError, Closeable, Startable, debug


class DebugSession(Startable, Closeable):
    """A single DAP session for a network client socket."""

    MESSAGE_PROCESSOR = None

    NAME = 'debug session'
    FAIL_ON_ALREADY_CLOSED = False
    FAIL_ON_ALREADY_STOPPED = False

    @classmethod
    def from_raw(cls, raw, **kwargs):
        """Return a session for the given data."""
        if isinstance(raw, cls):
            return raw
        if not is_socket(raw):
            # TODO: Create a new client socket from a remote address?
            #addr = Address.from_raw(raw)
            raise NotImplementedError
        client = raw
        return cls(client, **kwargs)

    @classmethod
    def from_server_socket(cls, server, **kwargs):
        """Return a session for the next connection to the given socket."""
        client, _ = server.accept()
        return cls(client, ownsock=True, **kwargs)

    def __init__(self, sock,
                 notify_closing=None,
                 notify_disconnecting=None,
                 ownsock=False):
        super(DebugSession, self).__init__()

        if notify_closing is not None:
            def handle_closing(before):
                if before:
                    notify_closing(self)
            self.add_close_handler(handle_closing)

        if notify_disconnecting is None:
            notify_disconnecting = (lambda _: None)
        self._notify_disconnecting = notify_disconnecting

        self._sock = sock
        self._pre_socket_close = None
        if ownsock:
            # Close the socket *after* calling sys.exit() (via notify_closing).
            def handle_closing(before):
                if before:
                    return
                debug('closing session socket')
                proc = self._msgprocessor
                if self._pre_socket_close is not None:
                    self._pre_socket_close()
                if proc is not None:
                    try:
                        proc.wait_while_connected(10)  # seconds
                    except TimeoutError:
                        debug('timed out waiting for disconnect')
                close_socket(self._sock)
            self.add_close_handler(handle_closing)

        self._msgprocessor = None

    @property
    def socket(self):
        return self._sock

    @property
    def msgprocessor(self):
        return self._msgprocessor

    def handle_debugger_stopped(self, wait=None):
        """Deal with the debugger exiting."""
        proc = self._msgprocessor
        if proc is None:
            return
        proc.handle_debugger_stopped(wait)

    def handle_exiting(self, exitcode=None, wait=None):
        """Deal with the debuggee exiting."""
        proc = self._msgprocessor
        if proc is None:
            return
        proc.handle_exiting(exitcode, wait)

    def wait_until_stopped(self):
        """Block until all resources (e.g. message processor) have stopped."""
        proc = self._msgprocessor
        if proc is None:
            return
        # TODO: Do this in VSCodeMessageProcessor.close()?
        proc._wait_for_server_thread()

    # internal methods

    def _new_msg_processor(self, **kwargs):
        return self.MESSAGE_PROCESSOR(
            self._sock,
            notify_disconnecting=self._handle_vsc_disconnect,
            notify_closing=self._handle_vsc_close,
            **kwargs
        )

    def _start(self, threadname, **kwargs):
        """Start the message handling for the session."""
        self._msgprocessor = self._new_msg_processor(**kwargs)
        self.add_resource_to_close(self._msgprocessor)
        self._msgprocessor.start(threadname)
        return self._msgprocessor_running

    def _stop(self):
        proc = self._msgprocessor
        if proc is None:
            return

        debug('proc stopping')
        # TODO: We should not need to wait if not exiting.
        # The editor will send a "disconnect" request at this point.
        proc._wait_for_disconnect()
        proc.close()
        self._msgprocessor = None

    def _close(self):
        debug('session closing')
        pass

    def _msgprocessor_running(self):
        if self._msgprocessor is None:
            return False
        # TODO: Return self._msgprocessor.is_running().
        return True

    # internal methods for VSCodeMessageProcessor

    def _handle_vsc_disconnect(self, pre_socket_close=None):
        debug('disconnecting')
        self._pre_socket_close = pre_socket_close  # TODO: Fail if already set?
        self._notify_disconnecting(self)

    def _handle_vsc_close(self):
        debug('processor closing')
        try:
            self.close()
        except ClosedError:
            pass


class PyDevdDebugSession(DebugSession):
    """A single DAP session for a network client socket."""

    MESSAGE_PROCESSOR = VSCodeMessageProcessor

    def __init__(self, sock,
                 notify_debugger_ready=None,
                 **kwargs):
        super(PyDevdDebugSession, self).__init__(sock, **kwargs)

        def notify_debugger_ready(session, _notify=notify_debugger_ready):
            if self._notified_debugger_ready:
                return
            self._notified_debugger_ready = True
            if _notify is not None:
                _notify(session)
        self._notified_debugger_ready = False
        self._notify_debugger_ready = notify_debugger_ready

    def handle_pydevd_message(self, cmdid, seq, text):
        if self._msgprocessor is None:
            # TODO: Do more than ignore?
            return
        return self._msgprocessor.on_pydevd_event(cmdid, seq, text)

    # internal methods

    def _new_msg_processor(self, **kwargs):
        return super(PyDevdDebugSession, self)._new_msg_processor(
            notify_debugger_ready=self._handle_vsc_debugger_ready,
            **kwargs
        )

    # internal methods for VSCodeMessageProcessor

    def _handle_vsc_debugger_ready(self):
        debug('ready to debug')
        self._notify_debugger_ready(self)
