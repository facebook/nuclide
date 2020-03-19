
import sys
import socket
import select
import time
import re
import json
import struct
import imp
import traceback
import random
import os
import io
import inspect
import types
from collections import deque
import os
import warnings
from encodings import utf_8, ascii
try:
    import thread
except ImportError:
    # Renamed in Python 3
    import _thread as thread

# Reference material
# http://jupyter-client.readthedocs.io/en/latest/messaging.html
# http://pydoc.net/Python/magni/1.4.0/magni.tests.ipynb_examples/
# http://www.xavierdupre.fr/app/pyquickhelper/helpsphinx/_modules/pyquickhelper/ipythonhelper/notebook_runner.html

import visualstudio_py_util as _vspu

to_bytes = _vspu.to_bytes
read_bytes = _vspu.read_bytes
read_int = _vspu.read_int
read_string = _vspu.read_string
write_bytes = _vspu.write_bytes
write_int = _vspu.write_int
write_string = _vspu.write_string

try:
    unicode
except NameError:
    unicode = str

try:
    BaseException
except NameError:
    # BaseException not defined until Python 2.5
    BaseException = Exception

try:
    from Queue import Empty, Queue  # Python 2
except ImportError:
    from queue import Empty, Queue  # Python 3

DEBUG = os.environ.get('DEBUG_EXTENSION_IPYTHON', '0') == '1'
TEST = os.environ.get('VSC_PYTHON_CI_TEST', '0') == '1'

def _debug_write(out):
    if DEBUG:
        sys.__stdout__.write(out)
        sys.__stdout__.write("\n")
        sys.__stdout__.flush()

class SafeSendLock(object):
    """a lock which ensures we're released if we take a KeyboardInterrupt exception acquiring it"""

    def __init__(self):
        self.lock = thread.allocate_lock()

    def __enter__(self):
        self.acquire()

    def __exit__(self, exc_type, exc_value, tb):
        self.release()

    def acquire(self):
        try:
            self.lock.acquire()
        except KeyboardInterrupt:
            try:
                self.lock.release()
            except:
                pass
            raise

    def release(self):
        self.lock.release()


class jediSocketServer(object):
    """back end for executing code in kernel.  Handles all of the communication with the remote process."""

    """Messages sent back as responses"""
    _PONG = to_bytes('PONG')
    _EXIT = to_bytes('EXIT')
    _LSKS = to_bytes('LSKS')
    _EROR = to_bytes('EROR')
    _TEST = to_bytes('TEST')
    _STRK = to_bytes('STRK')
    _STPK = to_bytes('STPK')
    _RSTK = to_bytes('RSTK')
    _ITPK = to_bytes('ITPK')
    _RUN = to_bytes('RUN ')
    _SHEL = to_bytes('SHEL')
    _IOPB = to_bytes('IOPB')

    def __init__(self):
        import threading
        self.conn = None
        self.send_lock = SafeSendLock()
        self.input_event = threading.Lock()
        # lock starts acquired (we use it like a manual reset event)
        self.input_event.acquire()
        self.input_string = None
        self.exit_requested = False
        self.kernelMonitor = None
        self.shell_channel = None

    def connect(self, port):
        # start a new thread for communicating w/ the remote process
        _debug_write('Connecting to socket port: ' + str(port))
        self.conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.conn.connect(('127.0.0.1', port))
        _debug_write('Connected to socket')

        # perform the handshake
        with self.send_lock:
            write_string(self.conn, "Some Guid")
            write_int(self.conn, os.getpid())

        _debug_write('Handshake information sent')

        thread.start_new_thread(self.start_processing, ())

    def start_processing(self):
        """loop on created thread which processes communicates with the REPL window"""

        _debug_write('Started processing thread')
        try:
            while True:
                if self.check_for_exit_socket_loop():
                    break

                # we receive a series of 4 byte commands. Each command then
                # has its own format which we must parse before continuing to
                # the next command.
                self.flush()
                self.conn.settimeout(10)
                try:
                    inp = read_bytes(self.conn, 4)
                    self.conn.settimeout(None)
                    cmd = jediSocketServer._COMMANDS.get(inp)
                    if inp and cmd is not None:
                        id = ""
                        try:
                            if jediSocketServer._COMMANDS_WITH_IDS.get(inp) == True:
                                while True:
                                    try:
                                        id = read_string(self.conn)
                                        break
                                    except socket.timeout:
                                        pass
                                cmd(self, id)
                            else:
                                cmd(self)
                        except:
                            commandName = utf_8.decode(inp)[0]
                            try:
                                commandName = ascii.Codec.encode(commandName)[
                                    0]
                            except UnicodeEncodeError:
                                pass
                            self.replyWithError(commandName, id)
                    else:
                        if inp:
                            print ('unknown command', inp)
                        break
                except socket.timeout:
                    pass

        except IPythonExitException:
            _debug_write('IPythonExitException')
            _debug_write(traceback.format_exc())
            pass
        except socket.error:
            _debug_write('socket error')
            _debug_write(traceback.format_exc())
            pass
        except:
            _debug_write('error in repl loop')
            _debug_write(traceback.format_exc())

            # try and exit gracefully, then interrupt main if necessary
            time.sleep(2)
            traceback.print_exc()
            self.exit_process()

    def check_for_exit_socket_loop(self):
        return self.exit_requested

    def replyWithError(self, commandName, id):
        with self.send_lock:
            traceMessage = traceback.format_exc()
            _debug_write('Replying with error:' + traceMessage)

            write_bytes(self.conn, jediSocketServer._EROR)
            write_string(self.conn, commandName)
            write_string(self.conn, "" if id is None else id)
            write_string(self.conn, traceMessage)

    def _cmd_exit(self):
        """exits the interactive process"""
        self.exit_requested = True
        self.exit_process()

    def _cmd_ping(self, id):
        """ping"""
        _debug_write('Ping received')
        while True:
            try:
                message = read_string(self.conn)
                break
            except socket.timeout:
                pass
        with self.send_lock:
            _debug_write('Pong response being sent out')
            write_bytes(self.conn, jediSocketServer._PONG)
            write_string(self.conn, id)
            write_string(self.conn, message)

    def _cmd_lstk(self, id):
        """List kernel specs"""
        _debug_write('Listing kernel specs')
        kernelspecs = json.dumps(listKernelSpecs())
        with self.send_lock:
            _debug_write('Replying with kernel Specs')
            write_bytes(self.conn, jediSocketServer._LSKS)
            write_string(self.conn, id)
            write_string(self.conn, kernelspecs)

    def _cmd_strk(self, id):
        """Start a kernel by name"""
        _debug_write('Listing kernel specs')
        while True:
            try:
                kernelName = read_string(self.conn)
                break
            except socket.timeout:
                pass
        kernelUUID = multiKernelManager.start_kernel(kernel_name=kernelName)
        self._postStartKernel(kernelUUID)

        # get the config and the connection FileExistsError
        try:
            config = kernel_manager.config
        except:
            config = {}
        try:
            connection_file = kernel_manager.connection_file
        except:
            connection_file = ""

        with self.send_lock:
            _debug_write('Replying with kernel Specs= ' + str(kernelUUID))
            write_bytes(self.conn, jediSocketServer._STRK)
            write_string(self.conn, id)
            write_string(self.conn, str(kernelUUID))
            write_string(self.conn, json.dumps(config))
            write_string(self.conn, connection_file)

    def _postStartKernel(self, kernelUUID):
        kernel_manager = multiKernelManager.get_kernel(kernelUUID)
        kernel_client = kernel_manager.client()
        kernel_client.start_channels()

        try:
            # IPython 3.x
            kernel_client.wait_for_ready()
            iopub = kernel_client
            shell = kernel_client
            # todo: get_stdin_msg
        except AttributeError:
            # Ipython 2.x
            # Based on https://github.com/paulgb/runipy/pull/49/files
            iopub = kernel_client.iopub_channel
            shell = kernel_client.shell_channel
            shell.get_shell_msg = shell.get_msg
            iopub.get_iopub_msg = iopub.get_msg
            # todo: get_stdin_msg

        self.shell_channel = shell
        self.kernelMonitor = iPythonKernelResponseMonitor(
            kernelUUID, self.conn, self.send_lock, shell, iopub)

    def stopKernel(self, kernelUUID):
        """Shutdown a kernel by UUID"""
        try:
            if self.kernelMonitor is not None:
                self.kernelMonitor.stop()
        finally:
            pass

        try:
            kernel_manager = multiKernelManager.get_kernel(kernelUUID)
            kernel_client = kernel_manager.client()
            kernel_client.stop_channels()
        finally:
            pass

        try:
            kernel_manager = multiKernelManager.get_kernel(kernelUUID)
            kernel_manager.shutdown_kernel()
        except:
            pass
        finally:
            self.shell_channel = None
            self.kernelMonitor = None

    def _cmd_stpk(self, id):
        """Shutdown a kernel by UUID"""
        while True:
            try:
                kernelUUID = read_string(self.conn)
                break
            except socket.timeout:
                pass

        self.stopKernel(kernelUUID)

        with self.send_lock:
            write_bytes(self.conn, jediSocketServer._STPK)
            write_string(self.conn, id)

    def _cmd_kill(self, id):
        """Shutdown a kernel by UUID"""
        while True:
            try:
                kernelUUID = read_string(self.conn)
                break
            except socket.timeout:
                pass

        try:
            if self.kernelMonitor is not None:
                self.kernelMonitor.stop()
        finally:
            pass

        try:
            kernel_manager = multiKernelManager.get_kernel(kernelUUID)
            kernel_client = kernel_manager.client()
            kernel_client.stop_channels()
        finally:
            pass

        try:
            kernel_manager = multiKernelManager.get_kernel(kernelUUID)
            kernel_manager.shutdown_kernel()
        except:
            pass

    def _cmd_rstk(self, id):
        """Restart a kernel by UUID"""
        while True:
            try:
                kernelUUID = read_string(self.conn)
                break
            except socket.timeout:
                pass

        kernel_manager = multiKernelManager.get_kernel(kernelUUID)
        kernel_manager.restart_kernel(now=True)

        with self.send_lock:
            write_bytes(self.conn, jediSocketServer._RSTK)
            write_string(self.conn, id)

    def _cmd_itpk(self, id):
        """Interrupt a kernel by UUID"""
        while True:
            try:
                kernelUUID = read_string(self.conn)
                break
            except socket.timeout:
                pass
        kernel_manager = multiKernelManager.get_kernel(kernelUUID)
        kernel_manager.interrupt_kernel()
        with self.send_lock:
            write_bytes(self.conn, jediSocketServer._ITPK)
            write_string(self.conn, id)

    def _cmd_run(self, id):
        """runs the received snippet of code (kernel is expected to have been started)"""
        while True:
            try:
                code = read_string(self.conn)
                break
            except socket.timeout:
                pass
        msg_id = self.shell_channel.execute(code)
        _debug_write('msg_id = ' + msg_id)
        with self.send_lock:
            write_bytes(self.conn, jediSocketServer._RUN)
            write_string(self.conn, id)
            write_string(self.conn, msg_id)

    def _cmd_abrt(self):
        """aborts the current running command"""
        # abort command, interrupts execution of the main thread.
        pass

    def _cmd_inpl(self):
        """handles the input command which returns a string of input"""
        self.input_string = read_string(self.conn)
        self.input_event.release()

    def send_prompt(self, ps1, ps2, update_all=True):
        """sends the current prompt to the interactive window"""
        # with self.send_lock:
        #     write_bytes(self.conn, jediSocketServer._PRPC)
        #     write_string(self.conn, ps1)
        #     write_string(self.conn, ps2)
        #     write_int(self.conn, update_all)
        pass

    def send_error(self):
        """reports that an error occured to the interactive window"""
        with self.send_lock:
            write_bytes(self.conn, jediSocketServer._ERRE)

    def send_exit(self):
        """reports the that the REPL process has exited to the interactive window"""
        with self.send_lock:
            write_bytes(self.conn, jediSocketServer._EXIT)

    def send_command_executed(self):
        with self.send_lock:
            write_bytes(self.conn, jediSocketServer._DONE)

    def read_line(self):
        """reads a line of input from standard input"""
        with self.send_lock:
            write_bytes(self.conn, jediSocketServer._RDLN)
        self.input_event.acquire()
        return self.input_string

    def write_stdout(self, value):
        """writes a string to standard output in the remote console"""
        with self.send_lock:
            write_bytes(self.conn, jediSocketServer._STDO)
            write_string(self.conn, value)

    def write_stderr(self, value):
        """writes a string to standard input in the remote console"""
        with self.send_lock:
            write_bytes(self.conn, jediSocketServer._STDE)
            write_string(self.conn, value)

    ################################################################
    # Implementation of execution, etc...

    def execution_loop(self):
        """loop on the main thread which is responsible for executing code"""
        while True:
            exit = self.run_one_command(cur_modules, cur_ps1, cur_ps2)
            if exit:
                return

    def run_command(self, command):
        """runs the specified command which is a string containing code"""
        pass

    def interrupt_main(self):
        """aborts the current running command"""
        pass

    def exit_process(self):
        """exits the REPL process"""
        sys.exit(0)

    def flush(self):
        """flushes the stdout/stderr buffers"""
        pass

    _COMMANDS = {
        to_bytes('run '): _cmd_run,
        to_bytes('abrt'): _cmd_abrt,
        to_bytes('exit'): _cmd_exit,
        to_bytes('ping'): _cmd_ping,
        to_bytes('inpl'): _cmd_inpl,
        to_bytes('lsks'): _cmd_lstk,
        to_bytes('strk'): _cmd_strk,
        to_bytes('stpk'): _cmd_stpk,
        to_bytes('rstk'): _cmd_rstk,
        to_bytes('itpk'): _cmd_itpk,
        to_bytes('kill'): _cmd_kill,
    }

    _COMMANDS_WITH_IDS = {
        to_bytes('lsks'): True,
        to_bytes('ping'): True,
        to_bytes('strk'): True,
        to_bytes('stpk'): True,
        to_bytes('rstk'): True,
        to_bytes('itpk'): True,
        to_bytes('run '): True,
    }




def exit_work_item():
    sys.exit(0)


class jediReadLine(object):

    def __init__(self):
        self._input = io.open(sys.stdin.fileno(), encoding='utf-8')

    def _deserialize(self, request):
        """Deserialize request from VSCode.

        Args:
            request: String with raw request from VSCode.

        Returns:
            Python dictionary with request data.
        """
        return json.loads(request)

    def _set_request_config(self, config):
        self.use_snippets = config.get('useSnippets')
        self.show_doc_strings = config.get('showDescriptions', True)
        self.fuzzy_matcher = config.get('fuzzyMatcher', False)

    def _process_request(self, request):
        """Accept serialized request from VSCode and write response.
        """
        request = self._deserialize(request)

        self._set_request_config(request.get('config', {}))

        lookup = request.get('lookup', 'completions')

        if lookup == 'definitions':
            return self._write_response('defs')
        elif lookup == 'arguments':
            return self._write_response('arguments')
        elif lookup == 'usages':
            return self._write_response('usages')
        else:
            return self._write_response('Dont Know')

    def _write_response(self, response):
        sys.stdout.write(response + '\n')
        sys.stdout.flush()

    def watch(self):
        port = int(sys.argv[1])
        _debug_write('Socket port received: ' + str(port))
        server = jediSocketServer()
        server.connect(port)
        sys.__stdout__.write('Started')
        sys.__stdout__.write("\n")
        sys.__stdout__.flush()
        while True:
            try:
                kernelUUID = self._input.readline()
                sys.__stdout__.write('about to die\n')
                sys.__stdout__.flush()
                if (len(kernelUUID) > 0):
                    try:
                        server.stopKernel(kernelUUID)
                    except:
                        pass
                server.exit_requested = True
                sys.__stdout__.write('adios\n')
                sys.__stdout__.flush()
            except Exception:
                sys.stderr.write(traceback.format_exc() + '\n')
                sys.stderr.flush()

if __name__ == '__main__':
    jediReadLine().watch()
