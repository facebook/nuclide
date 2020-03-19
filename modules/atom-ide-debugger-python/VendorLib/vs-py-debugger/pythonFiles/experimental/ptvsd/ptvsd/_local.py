# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

import sys
import time

import pydevd
from _pydevd_bundle.pydevd_comm import get_global_debugger

from ptvsd.pydevd_hooks import install
from ptvsd.runner import run as no_debug_runner
from ptvsd.socket import Address
from ptvsd._util import new_hidden_thread


PYDEVD_DEFAULTS = {
    '--qt-support=auto',
}


def _set_pydevd_defaults(pydevd_args):
    args_to_append = []
    for arg in PYDEVD_DEFAULTS:
        if arg not in pydevd_args:
            args_to_append.append(arg)
    return pydevd_args + args_to_append


########################
# high-level functions

def debug_main(address, name, kind, *extra, **kwargs):
    if not kwargs.pop('wait', False) and address.isserver:
        def unblock_debugger():
            debugger = get_global_debugger()
            while debugger is None:
                time.sleep(0.1)
                debugger = get_global_debugger()
            debugger.ready_to_run = True
        new_hidden_thread('ptvsd.unblock_debugger', unblock_debugger).start()
    if kind == 'module':
        run_module(address, name, *extra, **kwargs)
    else:
        run_file(address, name, *extra, **kwargs)


def run_main(address, name, kind, *extra, **kwargs):
    addr = Address.from_raw(address)
    sys.argv[:] = _run_main_argv(name, extra)
    runner = kwargs.pop('_runner', no_debug_runner)
    runner(addr, name, kind == 'module', *extra, **kwargs)


########################
# low-level functions

def run_module(address, modname, *extra, **kwargs):
    """Run pydevd for the given module."""
    addr = Address.from_raw(address)
    if not addr.isserver:
        kwargs['singlesession'] = True
    run = kwargs.pop('_run', _run)
    prog = kwargs.pop('_prog', sys.argv[0])
    filename = modname + ':'
    argv = _run_argv(addr, filename, extra, _prog=prog)
    argv.insert(argv.index('--file'), '--module')
    run(argv, addr, **kwargs)


def run_file(address, filename, *extra, **kwargs):
    """Run pydevd for the given Python file."""
    addr = Address.from_raw(address)
    if not addr.isserver:
        kwargs['singlesession'] = True
    run = kwargs.pop('_run', _run)
    prog = kwargs.pop('_prog', sys.argv[0])
    argv = _run_argv(addr, filename, extra, _prog=prog)
    run(argv, addr, **kwargs)


def _run_argv(address, filename, extra, _prog=sys.argv[0]):
    """Convert the given values to an argv that pydevd.main() supports."""
    if '--' in extra:
        pydevd = list(extra[:extra.index('--')])
        extra = list(extra[len(pydevd) + 1:])
    else:
        pydevd = []
        extra = list(extra)

    pydevd = _set_pydevd_defaults(pydevd)
    host, port = address
    argv = [
        _prog,
        '--port', str(port),
    ]
    if not address.isserver:
        argv.extend([
            '--client', host or 'localhost',
        ])
    return argv + pydevd + [
        '--file', filename,
    ] + extra


def _run_main_argv(filename, extra):
    if '--' in extra:
        pydevd = list(extra[:extra.index('--')])
        extra = list(extra[len(pydevd) + 1:])
    else:
        extra = list(extra)
    return [filename] + extra


def _run(argv, addr, _pydevd=pydevd, _install=install, **kwargs):
    """Start pydevd with the given commandline args."""
    #print(' '.join(argv))

    # Pydevd assumes that the "__main__" module is the "pydevd" module
    # and does some tricky stuff under that assumption.  For example,
    # when the debugger starts up it calls save_main_module()
    # (in pydevd_bundle/pydevd_utils.py).  That function explicitly sets
    # sys.modules["pydevd"] to sys.modules["__main__"] and then sets
    # the __main__ module to a new one.  This makes some sense since
    # it gives the debugged script a fresh __main__ module.
    #
    # This complicates things for us since we are running a different
    # file (i.e. this one) as the __main__ module.  Consequently,
    # sys.modules["pydevd"] gets set to ptvsd/__main__.py.  Subsequent
    # imports of the "pydevd" module then return the wrong module.  We
    # work around this by avoiding lazy imports of the "pydevd" module.
    # We also replace the __main__ module with the "pydevd" module here.
    if sys.modules['__main__'].__file__ != _pydevd.__file__:
        sys.modules['__main___orig'] = sys.modules['__main__']
        sys.modules['__main__'] = _pydevd

    daemon = _install(_pydevd, addr, **kwargs)
    sys.argv[:] = argv
    try:
        _pydevd.main()
    except SystemExit as ex:
        daemon.exitcode = int(ex.code)
        raise
