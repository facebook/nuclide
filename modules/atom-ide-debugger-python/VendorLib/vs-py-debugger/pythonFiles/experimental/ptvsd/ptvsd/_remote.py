# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

import pydevd
import time

from _pydevd_bundle.pydevd_comm import get_global_debugger

from ptvsd._util import new_hidden_thread
from ptvsd.pydevd_hooks import install
from ptvsd.daemon import session_not_bound, DaemonClosedError


def _pydevd_settrace(redirect_output=None, _pydevd=pydevd, **kwargs):
    if redirect_output is not None:
        kwargs.setdefault('stdoutToServer', redirect_output)
        kwargs.setdefault('stderrToServer', redirect_output)
    # pydevd.settrace() only enables debugging of the current
    # thread and all future threads.  PyDevd is not enabled for
    # existing threads (other than the current one).  Consequently,
    # pydevd.settrace() must be called ASAP in the current thread.
    # See issue #509.
    #
    # This is tricky, however, because settrace() will block until
    # it receives a CMD_RUN message.  You can't just call it in a
    # thread to avoid blocking; doing so would prevent the current
    # thread from being debugged.
    _pydevd.settrace(**kwargs)


# TODO: Split up enable_attach() to align with module organization.
# This should including making better use of Daemon (e,g, the
# start_server() method).
# Then move at least some parts to the appropriate modules.  This module
# is focused on running the debugger.

global_next_session = None


def enable_attach(address, redirect_output=True,
                  _pydevd=pydevd, _install=install,
                  on_attach=lambda: None, **kwargs):
    host, port = address

    def wait_for_connection(daemon, host, port, next_session=None):
        debugger = get_global_debugger()
        while debugger is None:
            time.sleep(0.1)
            debugger = get_global_debugger()

        debugger.ready_to_run = True

        while True:
            session_not_bound.wait()
            try:
                global_next_session()
                on_attach()
            except DaemonClosedError:
                return

    def start_daemon():
        daemon._sock = daemon._start()
        _, next_session = daemon.start_server(addr=(host, port))
        global global_next_session
        global_next_session = next_session
        return daemon._sock

    daemon = _install(_pydevd,
                      address,
                      start_server=None,
                      start_client=(lambda daemon, h, port: start_daemon()),
                      singlesession=False,
                      **kwargs)

    connection_thread = new_hidden_thread('ptvsd.listen_for_connection',
                                          wait_for_connection,
                                          args=(daemon, host, port))
    connection_thread.start()

    _pydevd.settrace(host=host,
                     stdoutToServer=redirect_output,
                     stderrToServer=redirect_output,
                     port=port,
                     suspend=False)


def attach(address,
           redirect_output=True,
           _pydevd=pydevd,
           _install=install,
           **kwargs):

    host, port = address
    _install(_pydevd,
             address,
             singlesession=False,
             **kwargs)
    _pydevd.settrace(host=host,
                     port=port,
                     stdoutToServer=redirect_output,
                     stderrToServer=redirect_output,
                     suspend=False)
