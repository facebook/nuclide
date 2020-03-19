# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE in the project root
# for license information.

import argparse
import os.path
import sys

from ptvsd._attach import attach_main
from ptvsd._local import debug_main, run_main
from ptvsd.socket import Address
from ptvsd.version import __version__, __author__  # noqa


##################################
# the script

"""
For the PyDevd CLI handling see:

  https://github.com/fabioz/PyDev.Debugger/blob/master/_pydevd_bundle/pydevd_command_line_handling.py
  https://github.com/fabioz/PyDev.Debugger/blob/master/pydevd.py#L1450  (main func)
"""  # noqa

PYDEVD_OPTS = {
    '--file',
    '--vm_type',
}

PYDEVD_FLAGS = {
    '--DEBUG',
    '--DEBUG_RECORD_SOCKET_READS',
    '--cmd-line',
    '--module',
    '--multiproc',
    '--multiprocess',
    '--print-in-debugger-startup',
    '--save-signatures',
    '--save-threading',
    '--save-asyncio',
    '--server',
    '--qt-support=auto',
}

USAGE = """
  {0} [-h] [-V] [--nodebug] [--client] [--host HOST] --port PORT -m MODULE [arg ...]
  {0} [-h] [-V] [--nodebug] [--client] [--host HOST] --port PORT FILENAME [arg ...]
  {0} [-h] [-V] --host HOST --port PORT --pid PROCESS_ID
"""  # noqa


def parse_args(argv=None):
    """Return the parsed args to use in main()."""
    if argv is None:
        argv = sys.argv
        prog = argv[0]
        if prog == __file__:
            prog = '{} -m ptvsd'.format(os.path.basename(sys.executable))
    else:
        prog = argv[0]
    argv = argv[1:]

    supported, pydevd, script = _group_args(argv)
    args = _parse_args(prog, supported)
    # '--' is used in _run_args to extract pydevd specific args
    extra = pydevd + ['--']
    if script:
        extra += script
    return args, extra


def _group_args(argv):
    supported = []
    pydevd = []
    script = []

    try:
        pos = argv.index('--')
    except ValueError:
        script = []
    else:
        script = argv[pos + 1:]
        argv = argv[:pos]

    for arg in argv:
        if arg == '-h' or arg == '--help':
            return argv, [], script

    gottarget = False
    skip = 0
    for i in range(len(argv)):
        if skip:
            skip -= 1
            continue

        arg = argv[i]
        try:
            nextarg = argv[i + 1]
        except IndexError:
            nextarg = None

        # TODO: Deprecate the PyDevd arg support.
        # PyDevd support
        if gottarget:
            script = argv[i:] + script
            break
        if arg == '--file':
            if nextarg is None:  # The filename is missing...
                pydevd.append(arg)
                continue  # This will get handled later.
            if nextarg.endswith(':') and '--module' in pydevd:
                pydevd.remove('--module')
                arg = '-m'
                argv[i + 1] = nextarg = nextarg[:-1]
            else:
                arg = nextarg
                skip += 1

        if arg in PYDEVD_OPTS:
            pydevd.append(arg)
            if nextarg is not None:
                pydevd.append(nextarg)
            skip += 1
        elif arg in PYDEVD_FLAGS:
            pydevd.append(arg)
        elif arg == '--nodebug':
            supported.append(arg)

        # ptvsd support
        elif arg in ('--host', '--port', '--pid', '-m'):
            if arg == '-m' or arg == '--pid':
                gottarget = True
            supported.append(arg)
            if nextarg is not None:
                supported.append(nextarg)
            skip += 1
        elif arg in ('--single-session', '--wait', '--client'):
            supported.append(arg)
        elif not arg.startswith('-'):
            supported.append(arg)
            gottarget = True

        # unsupported arg
        else:
            supported.append(arg)
            break

    return supported, pydevd, script


def _parse_args(prog, argv):
    parser = argparse.ArgumentParser(
        prog=prog,
        usage=USAGE.format(prog),
    )

    parser.add_argument('--nodebug', action='store_true')
    parser.add_argument('--client', action='store_true')

    parser.add_argument('--host', required=True)
    parser.add_argument('--port', type=int, required=True)

    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument('-m', dest='module')
    target.add_argument('--pid', type=int)
    target.add_argument('filename', nargs='?')

    parser.add_argument('--single-session', action='store_true')
    parser.add_argument('--wait', action='store_true')

    parser.add_argument('-V', '--version', action='version')
    parser.version = __version__

    args = parser.parse_args(argv)
    ns = vars(args)

    host = ns.pop('host', None)
    port = ns.pop('port')
    client = ns.pop('client')
    args.address = (Address.as_client if client else Address.as_server)(host, port) # noqa

    pid = ns.pop('pid')
    module = ns.pop('module')
    filename = ns.pop('filename')
    if pid is not None:
        args.name = pid
        args.kind = 'pid'
    elif module is not None:
        args.name = module
        args.kind = 'module'
    else:
        args.name = filename
        args.kind = 'script'

    return args


def handle_args(addr, name, kind, extra=(), nodebug=False, **kwargs):
    if kind == 'pid':
        attach_main(addr, name, *extra, **kwargs)
    elif nodebug:
        run_main(addr, name, kind, *extra, **kwargs)
    else:
        debug_main(addr, name, kind, *extra, **kwargs)


def main(argv=None):
    args, extra = parse_args(argv)
    handle_args(args.address, args.name, args.kind, extra,
                nodebug=args.nodebug, singlesession=args.single_session,
                wait=args.wait)


if __name__ == '__main__':
    main()
