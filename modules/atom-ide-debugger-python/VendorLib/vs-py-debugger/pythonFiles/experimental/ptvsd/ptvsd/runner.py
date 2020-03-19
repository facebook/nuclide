# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

import pydevd
import threading

from ptvsd.daemon import DaemonBase
from ptvsd.session import DebugSession
from ptvsd.wrapper import VSCLifecycleMsgProcessor
from pydevd import init_stdout_redirect, init_stderr_redirect


HOSTNAME = 'localhost'


def run(address, filename, is_module, *args, **kwargs):
    # TODO: docstring
    # TODO: client/server -> address
    daemon = Daemon()
    if not daemon.wait_for_launch(address):
        return

    debugger = pydevd.PyDB()
    # We do not want some internal methods to get executed in non-debug mode.
    debugger.init_matplotlib_support = lambda *arg: None
    debugger.run(
        file=filename,
        globals=None,
        locals=None,
        is_module=is_module,
        set_trace=False)


class Daemon(DaemonBase):
    """The process-level manager for the VSC protocol debug adapter."""

    LAUNCH_TIMEOUT = 10000  # seconds

    class SESSION(DebugSession):
        class MESSAGE_PROCESSOR(VSCLifecycleMsgProcessor):
            def on_invalid_request(self, request, args):
                self.send_response(request, success=True)

    def wait_for_launch(self, addr, timeout=LAUNCH_TIMEOUT):
        # TODO: docstring
        launched = threading.Event()
        _, start_session = self.start_client(addr)
        start_session(
            notify_launch=launched.set,
        )
        return launched.wait(timeout)

    def _start(self):
        import weakref
        weak_self = weakref.ref(self)  # Avoid cyclic ref

        def on_stdout(msg):
            self = weak_self()
            if self is not None:
                self._send_output('stdout', msg)

        def on_stderr(msg):
            self = weak_self()
            if self is not None:
                self._send_output('stderr', msg)

        init_stdout_redirect(on_stdout)
        init_stderr_redirect(on_stderr)
        return NoSocket()

    def _close(self):
        super(Daemon, self)._close()

    def _send_output(self, category, output):
        if self.session is None:
            return
        self.session._msgprocessor.send_event('output',
                                              category=category,
                                              output=output)


class NoSocket(object):
    """A object with a noop socket lifecycle."""

    def shutdown(self, *args, **kwargs):
        pass

    def close(self):
        pass
