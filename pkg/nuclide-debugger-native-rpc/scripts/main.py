# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

""" Entry point for using the Python LLDB Chrome DevTools bridge as a
stand-alone application.
"""

from __future__ import print_function

from find_lldb import set_custom_lldb_path
from find_lldb import get_lldb

from shlex import split
from chromedebugger import ChromeDevToolsDebuggerApp
import argparse
import sys
import signal
import os
import json
from collections import namedtuple
from logging_helper import log_debug, log_error
from event_thread import LLDBListenerThread
from debugger_store import DebuggerStore
from chrome_channel import ChromeChannel
from ipc_channel import IpcChannel
import time


def parse_args():
    '''Parse command line arguments.

    Most of the options are used for manual testing purpose.
    Nuclide will ignore them and pass most of the arguments
    using --arguments_in_json in separate file descriptor pipe
    so that we can reliably pass large block of data.
    '''
    parser = argparse.ArgumentParser(
        description='Python LLDB Chrome DevTools Bridge')
    parser.add_argument('--port', type=int, default=0,
                        help='Port for the server to bind. (default: any)')
    parser.add_argument('--basepath', type=str, default='.',
                        help='Path against which to resolve relative paths.')
    parser.add_argument('--interactive', '-i', action='store_true',
                        help='Interactive mode.')
    parser.add_argument('--arguments_in_json', '-json', action='store_true',
                        help='Receive the attach/launch arguments in JSON.')
    parser.add_argument('--lldb_python_path', type=str,
                        help='Path of the lldb python packages')
    parser.add_argument('--lldb_bootstrap_files', type=str, nargs='+',
                        help='Files with commands processed by lldb upon initialization')

    attach_group = parser.add_mutually_exclusive_group()
    attach_group.add_argument('--pname', '-n', type=str,
                              help='Attach to process with name.')
    attach_group.add_argument('--pid', '-p', type=int,
                              help='Attach to process with pid.')

    launch_group = parser.add_argument_group()
    launch_group.add_argument('--executable_path', '-e', type=str,
                              help='The executable path to launch.')
    launch_group.add_argument('--launch_arguments', '-args', type=str,
                              action='append', help='Launch arguments.')
    launch_group.add_argument('--launch_environment_variables', '-env',
                              type=str,
                              help='Comma-separated environment variables.')
    launch_group.add_argument('--working_directory', '-cwd', type=str,
                              help='Working directory for the executable.')
    launch_group.add_argument('--stdin_filepath', '-stdin',
                              type=str,
                              help='Redirect stdin for the process to this file.')
    launch_group.add_argument('--core_dump_path', '-core', type=str,
                              help='Path to core dump file to debug.')
    arguments = parser.parse_args()

    # Prefer arguments from JSON.
    return read_json_arguments_if_needed(arguments)


def read_json_arguments_if_needed(arguments):
    '''If arguments_in_json is enabled we parse all the
    arguments from a separate input pipe.
    '''
    if arguments.arguments_in_json:
        ARGUMENT_INPUT_FD = 3
        buffering = 1  # 1 means line-buffered.
        file = os.fdopen(ARGUMENT_INPUT_FD, 'r+', buffering)
        init_line = file.readline()
        if init_line.startswith('init'):
            file.write('ready\n')  # Tell parent channel is ready.
            arguments_input = file.readline()
            log_debug('Received json arguments: %s' % arguments_input)
            # Parse JSON into python object.
            arguments = json.loads(
                arguments_input,
                object_hook=lambda d: namedtuple('arguments', d.keys())(*d.values()))
            log_debug('Parsed arguments: %s' % json.dumps(arguments, ensure_ascii=False))
            file.close()
        else:
            # Fail: did not receive proper initialization sequence.
            log_error('LLDB got unknown init line: %s' % init_line)
            sys.exit(2)
    return arguments


def interactive_loop(debugger):
    while (True):
        sys.stdout.write('dbg> ')
        command = sys.stdin.readline().rstrip()
        if len(command) == 0:
            continue
        elif command == 'q':
            debugger.Destroy(debugger)
            log_debug('bye~')
            break
        elif command == 'b':
            debugger.GetSelectedTarget().process.Stop()
        else:
            debugger.HandleCommand(command)


def start_debugging(debugger, arguments, ipc_channel, is_attach):
    lldb = get_lldb()
    listener = lldb.SBListener('Chrome Dev Tools Listener')
    error = lldb.SBError()

    if getattr(arguments, 'lldb_bootstrap_files', None):
        bootstrap_files = arguments.lldb_bootstrap_files
        for file in bootstrap_files:
            debugger.HandleCommand(str('command source ' + file))
    elif getattr(arguments, 'executable_path', None):
        argument_list = map(os.path.expanduser, map(str, arguments.launch_arguments)) \
            if arguments.launch_arguments else None
        environment_variables = arguments.launch_environment_variables \
            if arguments.launch_environment_variables else None
        # TODO: should we resolve symbol link?
        executable_path = os.path.expanduser(str(arguments.executable_path)) \
            if arguments.executable_path else None
        working_directory = os.path.expanduser(str(arguments.working_directory)) \
            if arguments.working_directory else None
        stdin_filepath = os.path.expanduser(str(arguments.stdin_filepath)) \
            if arguments.stdin_filepath else None
        core_dump_path = os.path.expanduser(str(arguments.core_dump_path)) \
            if arguments.core_dump_path else None

        target = debugger.CreateTarget(
            executable_path,    # filename
            None,               # target_triple
            None,               # platform_name
            True,               # add_dependent_modules
            error)              # error
        if error.Fail():
            sys.exit(error.description)

        if core_dump_path is not None:
            target.LoadCore(core_dump_path)
        else:
            target.Launch(
                listener,
                argument_list,
                environment_variables,
                stdin_filepath,
                None,      # stdout_path
                None,      # stderr_path
                working_directory,
                0,         # launch flags
                True,      # Stop at entry
                error)     # error
    elif getattr(arguments, 'pname', None):
        target = debugger.CreateTarget(None)
        target.AttachToProcessWithName(
            listener,
            str(arguments.pname),
            False,   # does not wait for process to launch.
            error)
    elif getattr(arguments, 'pid', None):
        target = debugger.CreateTarget(None)
        target.AttachToProcessWithID(listener, int(arguments.pid), error)
    else:
        sys.exit('Unknown arguments: %s' % arguments)

    if error.Fail():
        sys.exit(error.description)
    else:
        if is_attach:
            output = 'Successfully attached process.'
        else:
            output = 'Successfully launched process.'
        ipc_channel.send_output_message_async('log', output)

def register_signal_handler(lldb_debugger):
    def handle_stop_debugging_signal(signum, frame):
        log_debug('handle_stop_debugging_signal called')
        if lldb_debugger.GetSelectedTarget() is not None and \
            lldb_debugger.GetSelectedTarget().process is not None and \
                lldb_debugger.GetSelectedTarget().process.state == \
                get_lldb().eStateStopped:
            lldb_debugger.GetSelectedTarget().process.Detach()
        os._exit(0)
    signal.signal(signal.SIGTERM, handle_stop_debugging_signal)


def main():
    arguments = parse_args()
    lldb_python_path = getattr(arguments, 'lldb_python_path', None)
    if lldb_python_path is not None:
        set_custom_lldb_path(os.path.expanduser(lldb_python_path))
    lldb = get_lldb()
    debugger = lldb.SBDebugger.Create()

    is_attach = (getattr(arguments, 'executable_path', None) == None)
    is_interactive = getattr(arguments, 'interactive', False)
    ipc_channel = IpcChannel(is_interactive)

    start_debugging(debugger, arguments, ipc_channel, is_attach)
    register_signal_handler(debugger)

    chrome_channel = ChromeChannel()
    debugger_store = DebuggerStore(
        debugger,
        chrome_channel,
        ipc_channel,
        is_attach,
        str(getattr(arguments, 'basepath', '.')))

    try:
        app = ChromeDevToolsDebuggerApp(debugger_store, getattr(arguments, 'port', 0))

        # Tell IDE server is ready.
        log_debug('Port: %s' % app.debug_server.server_port)

        event_thread = LLDBListenerThread(debugger_store, app)
        event_thread.start()

        if is_interactive:
            app.start_nonblocking()
            interactive_loop(debugger)
        else:
            app.start_blocking()
    except KeyboardInterrupt:  # Force app to exit on Ctrl-C.
        os._exit(1)

    event_thread.join()
    lldb.SBDebugger.Destroy(debugger)
    lldb.SBDebugger.Terminate()
    # TODO: investigate why we need os._exit() to terminate python process.
    os._exit(0)


if __name__ == '__main__':
    main()
