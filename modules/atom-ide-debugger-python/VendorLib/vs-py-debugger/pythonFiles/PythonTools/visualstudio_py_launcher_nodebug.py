# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

"""Run a block of code or Python file."""

import sys
import os.path
import traceback
import time
import socket
try:
    import visualstudio_py_util as _vspu
except:
    traceback.print_exc()
    print("""Internal error detected. Please copy the above traceback and report at
https://github.com/Microsoft/vscode-python/issues""")
    sys.exit(1)

LAST = _vspu.to_bytes('LAST')
OUTP = _vspu.to_bytes('OUTP')
LOAD = _vspu.to_bytes('LOAD')

def parse_argv():
    """Parses arguments for use with the launcher.
    Arguments are:
    1. Working directory.
    2. VS debugger port to connect to.
    3. GUID for the debug session.
    4. Debug options (not used).
    5. '-m' or '-c' to override the default run-as mode. [optional].
    6. Startup script name.
    7. Script arguments.
    """

    # Change to directory we expected to start from.
    os.chdir(sys.argv[1])

    port_num = int(sys.argv[2])
    debug_id = sys.argv[3]

    del sys.argv[:5]

    # Set run_as mode appropriately
    run_as = 'script'
    if sys.argv and sys.argv[0] == '-m':
        run_as = 'module'
        del sys.argv[0]
    elif sys.argv and sys.argv[0] == '-c':
        run_as = 'code'
        del sys.argv[0]

    # Preserve filename before we del sys.
    filename = sys.argv[0]

    # Fix sys.path to be the script file dir.
    sys.path[0] = ''

    pid = os.getpid()

    return (filename, port_num, debug_id, pid, run_as)

def run(file, port_num, debug_id, pid, run_as='script'):
    attach_process(port_num, pid, debug_id)

    # Now execute main file.
    globals_obj = {'__name__': '__main__'}

    try:
        if run_as == 'module':
            _vspu.exec_module(file, globals_obj)
        elif run_as == 'code':
            _vspu.exec_code(file, '<string>', globals_obj)
        else:
            _vspu.exec_file(file, globals_obj)
    except:
        exc_type, exc_value, exc_tb = sys.exc_info()
        handle_exception(exc_type, exc_value, exc_tb)

    _vspu.write_bytes(conn, LAST)
    # Wait for message to be received by debugger.
    time.sleep(0.5)


def attach_process(port_num, pid, debug_id):
    global conn
    for i in range(50):
        try:
            conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            conn.connect(('127.0.0.1', port_num))
            # Initial handshake.
            _vspu.write_string(conn, debug_id)
            _vspu.write_int(conn, 0)
            _vspu.write_int(conn, pid)

            # Notify debugger that process has launched.
            _vspu.write_bytes(conn, LOAD)
            _vspu.write_int(conn, 0)
            break
        except:
            time.sleep(50./1000)
    else:
        raise Exception('failed to attach')


def handle_exception(exc_type, exc_value, exc_tb):
    # Specifies list of files not to display in stack trace.
    do_not_debug = [__file__, _vspu.__file__]
    if sys.version_info >= (3, 3):
        do_not_debug.append('<frozen importlib._bootstrap>')
    if sys.version_info >= (3, 5):
        do_not_debug.append('<frozen importlib._bootstrap_external>')

    # Remove debugger frames from the top and bottom of the traceback.
    tb = traceback.extract_tb(exc_tb)
    for i in [0, -1]:
        while tb:
            frame_file = os.path.normcase(tb[i][0])
            if not any(is_same_py_file(frame_file, f) for f in do_not_debug):
                break
            del tb[i]

    # Print the traceback.
    if tb:
        sys.stderr.write('Traceback (most recent call last):')
        for out in traceback.format_list(tb):
            sys.stderr.write(out)
            sys.stderr.flush()

    # Print the exception.
    for out in traceback.format_exception_only(exc_type, exc_value):
        sys.stderr.write(out)
        sys.stderr.flush()


def is_same_py_file(file_1, file_2):
    """Compares 2 filenames accounting for .pyc files."""
    if file_1.endswith('.pyc') or file_1.endswith('.pyo'):
        file_1 = file_1[:-1]
    if file_2.endswith('.pyc') or file_2.endswith('.pyo'):
        file_2 = file_2[:-1]

    return file_1 == file_2

if __name__ == '__main__':
    filename, port_num, debug_id, pid, run_as = parse_argv()
    run(filename, port_num, debug_id, pid, run_as)
