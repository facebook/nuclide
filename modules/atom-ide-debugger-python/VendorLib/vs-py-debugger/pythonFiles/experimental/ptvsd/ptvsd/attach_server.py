# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

from ptvsd._remote import (
    attach as ptvsd_attach,
    enable_attach as ptvsd_enable_attach,
    _pydevd_settrace,
)
from ptvsd.wrapper import debugger_attached

import json
try:
    from urllib.request import urlopen, Request, URLError
except ImportError:
    from urllib2 import urlopen, Request, URLError

WAIT_TIMEOUT = 1.0

DEFAULT_HOST = '0.0.0.0'
DEFAULT_PORT = 5678

DEBUGGER_UI_PORT = 9615

_debug_current_thread = None
_pending_threads = set()

_attach_port = None
_ui_attach_enabled = False
_ui_attach_options = {}


def wait_for_attach(timeout=None):
    """If a remote debugger is attached, returns immediately. Otherwise,
    blocks until a remote debugger attaches to this process, or until the
    optional timeout occurs.

    Parameters
    ----------
    timeout : float, optional
        The timeout for the operation in seconds (or fractions thereof).
    """
    debugger_attached.wait(timeout)


def enable_attach(address=(DEFAULT_HOST, DEFAULT_PORT), redirect_output=True):
    """Enables a client to attach to this process remotely to debug Python code.

    Parameters
    ----------
    address : (str, int), optional
        Specifies the interface and port on which the debugging server should
        listen for TCP connections. It is in the same format as used for
        regular sockets of the `socket.AF_INET` family, i.e. a tuple of
        ``(hostname, port)``. On client side, the server is identified by the
        Qualifier string in the usual ``'hostname:port'`` format, e.g.:
        ``'myhost.cloudapp.net:5678'``. Default is ``('0.0.0.0', 5678)``.
    redirect_output : bool, optional
        Specifies whether any output (on both `stdout` and `stderr`) produced
        by this program should be sent to the debugger. Default is ``True``.

    Notes
    -----
    This function returns immediately after setting up the debugging server,
    and does not block program execution. If you need to block until debugger
    is attached, call `ptvsd.wait_for_attach`. The debugger can be detached
    and re-attached multiple times after `enable_attach` is called.

    Only the thread on which this function is called, and any threads that are
    created after it returns, will be visible in the debugger once it is
    attached. Any threads that are already running before this function is
    called will not be visible.
    """
    if is_attached():
        return
    debugger_attached.clear()

    # Ensure port is int
    port = address[1]
    address = (address[0], port if type(port) is int else int(port))

    global _attach_port
    _attach_port = address[1]

    ptvsd_enable_attach(
        address,
        redirect_output=redirect_output,
    )


def attach(address, redirect_output=True):
    """Attaches this process to the debugger listening on a given address.

    Parameters
    ----------
    address : (str, int), optional
        Specifies the interface and port on which the debugger is listening
        for TCP connections. It is in the same format as used for
        regular sockets of the `socket.AF_INET` family, i.e. a tuple of
        ``(hostname, port)``.
    redirect_output : bool, optional
        Specifies whether any output (on both `stdout` and `stderr`) produced
        by this program should be sent to the debugger. Default is ``True``.
    """
    if is_attached():
        return
    debugger_attached.clear()

    # Ensure port is int
    port = address[1]
    address = (address[0], port if type(port) is int else int(port))

    global _attach_port
    _attach_port = address[1]

    ptvsd_attach(address, redirect_output=redirect_output)


# TODO: Add disable_attach()?


def is_attached():
    """Returns ``True`` if debugger is attached, ``False`` otherwise."""
    return debugger_attached.isSet()


def break_into_debugger():
    """If a remote debugger is attached, pauses execution of all threads,
    and breaks into the debugger with current thread as active.
    """
    if not is_attached():
        return

    import sys
    _pydevd_settrace(
        suspend=True,
        trace_only_current_thread=True,
        patch_multiprocessing=False,
        stop_at_frame=sys._getframe().f_back,
    )


def set_attach_ui_options(options):
    global _ui_attach_options
    _ui_attach_options = options


# `set_trace` should pause debug execution and attach the debugger UI to the debugger engine
def set_trace():
    # Enable on-demand UI attach to the debugger.
    enable_attach_ui()
    # Trigger the debugger ui to attach, if one exists
    debugger_ui_attach()
    wait_for_attach(30)
    if is_attached():
        break_into_debugger()
    else:
        import sys
        sys.stderr.write('Debugger timed out (30 seconds) waiting for attach!\n')


def enable_attach_ui():
    global _attach_enabled, _ui_attach_options, _ui_attach_enabled
    if not is_attached():
        enable_attach()
    if not _ui_attach_enabled:
        _ui_attach_enabled = debugger_ui_enable_attach()


def debugger_ui_enable_attach():
    global _attach_port, _ui_attach_options
    attach_info = {"domain": "debug", "type": "python", "command": "enable-attach",
        "port": _attach_port, "options": _ui_attach_options}
    return debugger_ui_request(attach_info)


def debugger_ui_request(info):
    req = Request('http://127.0.0.1:' + str(DEBUGGER_UI_PORT),
        data=json.dumps(info).encode('utf8'),
        headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        response = urlopen(req)
    except URLError:
        # It's okay if there's no debugger ui server waiting for that info
        return False
    json_response = json.loads(response.read())
    if not json_response['success']:
        raise RuntimeError('Failed attach attempt')
    return True


def debugger_ui_attach():
    if is_attached():
        return
    global _attach_port
    attach_info = {"domain": "debug", "type": "python", "command": "attach", "port": _attach_port}
    debugger_ui_request(attach_info)
