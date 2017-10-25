/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import type {ConnectableObservable} from 'rxjs';
import type {
  DebuggerConfig,
  AttachTargetInfo,
  LaunchTargetInfo,
  BootstrapDebuggerInfo,
  PrepareForLaunchResponse,
} from './NativeDebuggerServiceInterface.js';
import type {Socket} from 'net';

import child_process from 'child_process';
import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {DebuggerRpcWebSocketService} from '../../nuclide-debugger-common';
import {observeStream} from 'nuclide-commons/stream';
import {splitStream} from 'nuclide-commons/observable';
import {runCommand} from 'nuclide-commons/process';
import {Observable} from 'rxjs';
import {track} from '../../nuclide-analytics';
import net from 'net';

type AttachInfoArgsType = {
  pid: string,
  basepath: string,
};

type LaunchInfoArgsType = {
  executable_path: string,
  launch_arguments: Array<string>,
  launch_environment_variables: Array<string>,
  working_directory: string,
  stdin_filepath: string,
  basepath: string,
};

type BootstrapInfoArgsType = {
  lldb_bootstrap_files: Array<string>,
  basepath: string,
};

type LaunchAttachArgsType =
  | AttachInfoArgsType
  | LaunchInfoArgsType
  | BootstrapInfoArgsType;

export async function getAttachTargetInfoList(
  targetPid: ?number,
): Promise<Array<AttachTargetInfo>> {
  // Get processes list from ps utility.
  // -e: include all processes, does not require -ww argument since truncation of process names is
  //     done by the OS, not the ps utility
  // -o pid,comm: custom format the output to be two columns(pid and process name)
  const pidToName: Map<number, string> = new Map();
  const processes = await runCommand(
    'ps',
    ['-e', '-o', 'pid,comm'],
    {},
  ).toPromise();
  processes
    .toString()
    .split('\n')
    .slice(1)
    .forEach(line => {
      const words = line.trim().split(' ');
      const pid = Number(words[0]);
      const command = words.slice(1).join(' ');
      const components = command.split('/');
      const name = components[components.length - 1];
      pidToName.set(pid, name);
    });
  // Get processes list from ps utility.
  // -e: include all processes
  // -ww: provides unlimited width for output and prevents the truncating of command names by ps.
  // -o pid,args: custom format the output to be two columns(pid and command name)
  const pidToCommand: Map<number, string> = new Map();
  const commands = await runCommand(
    'ps',
    ['-eww', '-o', 'pid,args'],
    {},
  ).toPromise();
  commands
    .toString()
    .split('\n')
    .slice(1)
    .forEach(line => {
      const words = line.trim().split(' ');
      const pid = Number(words[0]);
      const command = words.slice(1).join(' ');
      pidToCommand.set(pid, command);
    });
  // Filter out processes that have died in between ps calls and zombiue processes.
  // Place pid, process, and command info into AttachTargetInfo objects and return in an array.
  return Array.from(pidToName.entries())
    .filter(arr => {
      const [pid, name] = arr;
      if (targetPid != null) {
        return pid === targetPid;
      }
      return (
        pidToCommand.has(pid) &&
        !(name.startsWith('(') && name.endsWith(')')) &&
        (name.length < 9 || name.slice(-9) !== '<defunct>')
      );
    })
    .map(arr => {
      const [pid, name] = arr;
      const commandName = pidToCommand.get(pid);
      invariant(commandName != null);
      return {
        pid,
        name,
        commandName,
      };
    });
}

async function _getDefaultLLDBConfig(): Promise<{
  pythonPath: string,
  lldbModulePath: string,
}> {
  try {
    // $FlowFB
    const fbPaths = require('./fb-Paths');
    return {
      pythonPath: await fbPaths.getFBPythonPath(),
      lldbModulePath: await fbPaths.getFBLLDBModulePath(),
    };
  } catch (_) {}

  /*
   * Default is to use the system python and let the python scripts figure out
   * which lldb to use.
   */
  return {pythonPath: '/usr/bin/python', lldbModulePath: ''};
}

export class NativeDebuggerService extends DebuggerRpcWebSocketService {
  _config: DebuggerConfig;

  constructor(config: DebuggerConfig) {
    super('native');
    this._config = config;
    this.getLogger().setLevel(config.logLevel);
  }

  _expandPath(path: string, cwd: ?string): string {
    // Expand a path to interpret ~/ as home and ./ as relative
    // to the current working directory.
    return path.startsWith('./')
      ? nuclideUri.resolve(
          cwd != null ? nuclideUri.expandHomeDir(cwd) : '',
          path.substring(2),
        )
      : nuclideUri.expandHomeDir(path);
  }

  attach(attachInfo: AttachTargetInfo): ConnectableObservable<void> {
    this.getLogger().debug(`attach process: ${JSON.stringify(attachInfo)}`);
    const inferiorArguments = {
      pid: String(attachInfo.pid),
      basepath: this._expandPath(
        attachInfo.basepath != null
          ? attachInfo.basepath
          : this._config.buckConfigRootFile,
        null,
      ),
      lldb_python_path: this._expandPath(
        this._config.lldbPythonPath || '',
        null,
      ),
    };
    return Observable.fromPromise(
      this._startDebugging(inferiorArguments),
    ).publish();
  }

  launch(launchInfo: LaunchTargetInfo): ConnectableObservable<void> {
    this.getLogger().debug(`launch process: ${JSON.stringify(launchInfo)}`);
    const exePath = launchInfo.executablePath.trim();
    const inferiorArguments = {
      executable_path: this._expandPath(exePath, launchInfo.workingDirectory),
      launch_arguments: launchInfo.arguments,
      launch_environment_variables: launchInfo.environmentVariables,
      working_directory: launchInfo.workingDirectory,
      stdin_filepath: this._expandPath(
        launchInfo.stdinFilePath != null ? launchInfo.stdinFilePath : '',
        launchInfo.workingDirectory,
      ),
      basepath: this._expandPath(
        launchInfo.basepath != null
          ? launchInfo.basepath
          : this._config.buckConfigRootFile,
        launchInfo.workingDirectory,
      ),
      lldb_python_path: this._expandPath(
        this._config.lldbPythonPath || '',
        launchInfo.workingDirectory,
      ),
      core_dump_path: this._expandPath(
        launchInfo.coreDump || '',
        launchInfo.workingDirectory,
      ),
    };

    if (launchInfo.coreDump != null && launchInfo.coreDump !== '') {
      // Track feature usage of core dump debugging.
      track('nuclide-debugger-debug-coredump-start');
    }

    return Observable.fromPromise(
      this._startDebugging(inferiorArguments),
    ).publish();
  }

  bootstrap(bootstrapInfo: BootstrapDebuggerInfo): ConnectableObservable<void> {
    this.getLogger().debug(`bootstrap lldb: ${JSON.stringify(bootstrapInfo)}`);
    const inferiorArguments = {
      lldb_bootstrap_files: bootstrapInfo.lldbBootstrapFiles,
      // flowlint-next-line sketchy-null-string:off
      basepath: bootstrapInfo.basepath
        ? bootstrapInfo.basepath
        : this._config.buckConfigRootFile,
      lldb_python_path: this._config.lldbPythonPath,
    };
    return Observable.fromPromise(
      this._startDebugging(inferiorArguments),
    ).publish();
  }

  async _startDebugging(
    inferiorArguments: LaunchAttachArgsType,
  ): Promise<void> {
    const pythonBinaryPath =
      // flowlint-next-line sketchy-null-string:off
      this._config.pythonBinaryPath ||
      (await _getDefaultLLDBConfig()).pythonPath;
    const lldbPythonPath =
      // flowlint-next-line sketchy-null-mixed:off
      inferiorArguments.lldb_python_path ||
      (await _getDefaultLLDBConfig()).lldbModulePath;

    const lldbProcess = this._spawnPythonBackend(pythonBinaryPath);
    lldbProcess.on('exit', this._handleLLDBExit.bind(this));
    this._registerIpcChannel(lldbProcess);
    // $FlowIgnore typecast
    this._sendArgumentsToPythonBackend(lldbProcess, {
      ...inferiorArguments,
      lldb_python_path: lldbPythonPath,
    });
    const lldbWebSocketListeningPort = await this._connectWithLLDB(lldbProcess);

    // TODO[jeffreytan]: explicitly use ipv4 address 127.0.0.1 for now.
    // Investigate if we can use localhost and match protocol version between client/server.
    const lldbWebSocketAddress = `ws://127.0.0.1:${lldbWebSocketListeningPort}/`;
    await this.connectToWebSocketServer(lldbWebSocketAddress);
    this.getLogger().debug(
      `Connected with lldb at address: ${lldbWebSocketAddress}`,
    );
  }

  _registerIpcChannel(lldbProcess: child_process$ChildProcess): void {
    const IPC_CHANNEL_FD = 4;
    const ipcStream = lldbProcess.stdio[IPC_CHANNEL_FD];
    this.getSubscriptions().add(
      splitStream(
        observeStream(ipcStream),
      ).subscribe(this._handleIpcMessage.bind(this, ipcStream), error =>
        this.getLogger().error(`ipcStream error: ${JSON.stringify(error)}`),
      ),
    );
  }

  _handleIpcMessage(ipcStream: Object, message: string): void {
    this.getLogger().trace(`ipc message: ${message}`);
    const messageJson = JSON.parse(message);
    if (messageJson.type === 'Nuclide.userOutput') {
      // Write response message to ipc for sync message.
      if (messageJson.isSync) {
        ipcStream.write(
          JSON.stringify({
            message_id: messageJson.id,
          }) + '\n',
        );
      }
      this.getClientCallback().sendUserOutputMessage(
        JSON.stringify(messageJson.message),
      );
    } else {
      this.getLogger().error(`Unknown message: ${message}`);
    }
  }

  _spawnPythonBackend(pythonPath: string): child_process$ChildProcess {
    const lldbPythonScriptPath = nuclideUri.join(
      __dirname,
      '../scripts/main.py',
    );
    const python_args = [lldbPythonScriptPath, '--arguments_in_json'];
    const environ = process.env;
    environ.PYTHONPATH = this._config.envPythonPath;
    const options = {
      cwd: nuclideUri.dirname(lldbPythonScriptPath),
      // FD[3] is used for sending arguments JSON blob.
      // FD[4] is used as a ipc channel for output/atom notifications.
      stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'],
      detached: false, // When Atom is killed, clang_server.py should be killed, too.
      env: environ,
    };
    this.getLogger().info(
      `spawn child_process: ${JSON.stringify(python_args)}`,
    );
    const lldbProcess = child_process.spawn(pythonPath, python_args, options);
    this.getSubscriptions().add(() => lldbProcess.kill());
    return lldbProcess;
  }

  _sendArgumentsToPythonBackend(
    child: child_process$ChildProcess,
    args: LaunchAttachArgsType,
  ): void {
    const ARGUMENT_INPUT_FD = 3;
    const argumentsStream = child.stdio[ARGUMENT_INPUT_FD];
    // Make sure the bidirectional communication channel is set up before
    // sending data.
    argumentsStream.write('init\n');
    this.getSubscriptions().add(
      observeStream(argumentsStream)
        .first()
        .subscribe(
          text => {
            if (text.startsWith('ready')) {
              const args_in_json = JSON.stringify(args);
              this.getLogger().info(`Sending ${args_in_json} to child_process`);
              argumentsStream.write(`${args_in_json}\n`);
            } else {
              this.getLogger().error(`Get unknown initial data: ${text}.`);
              child.kill();
            }
          },
          error =>
            this.getLogger().error(
              `argumentsStream error: ${JSON.stringify(error)}`,
            ),
        ),
    );
  }

  _connectWithLLDB(lldbProcess: child_process$ChildProcess): Promise<string> {
    this.getLogger().debug('connecting with lldb');
    return new Promise((resolve, reject) => {
      // Async handle parsing websocket address from the stdout of the child.
      lldbProcess.stdout.on('data', chunk => {
        // stdout should hopefully be set to line-buffering, in which case the
        // string would come on one line.
        const block: string = chunk.toString();
        this.getLogger().debug(
          `child process(${lldbProcess.pid}) stdout: ${block}`,
        );
        const result = /Port: (\d+)\n/.exec(block);
        if (result != null) {
          // $FlowIssue - flow has wrong typing for it(t9649946).
          lldbProcess.stdout.removeAllListeners(['data', 'error', 'exit']);
          resolve(result[1]);
        }
      });
      lldbProcess.stderr.on('data', chunk => {
        const errorMessage = chunk.toString();
        this.getClientCallback().sendUserOutputMessage(
          JSON.stringify({
            level: 'error',
            text: errorMessage,
          }),
        );
        this.getLogger().error(
          `child process(${lldbProcess.pid}) stderr: ${errorMessage}`,
        );
      });
      lldbProcess.on('error', (err: Object) => {
        reject(new Error(`debugger server error: ${JSON.stringify(err)}`));
      });
      lldbProcess.on('exit', (code: number, signal: string) => {
        let message = `debugger server exits with code: ${code}`;
        if (signal != null) {
          message += `, because of signal ${signal}`;
        }
        reject(message);
      });
    });
  }

  _handleLLDBExit(): void {
    // Fire and forget.
    this.dispose();
  }

  // Spawns a TCP socket server to be used to communicate with the python
  // launch wrapper when launching a process in the terminal. The wrapper
  // will use this socket to communicate its pid, and wait for us to attach
  // a debugger before calling execv to load the target image into the process.
  async _spawnIpcServer(
    onConnectCallback: (socket: Socket) => void,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.on('error', reject);
      server.on('connection', socket => {
        socket.on('error', () => server.close);
        socket.on('end', () => server.close);
        onConnectCallback(socket);
        server.close();
      });

      try {
        server.listen({host: '127.0.0.1', port: 0}, () =>
          resolve(server.address().port),
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  // This callback is invoked when the wrapper process starts up and connects
  // to our TCP socket. It will send its own pid into the socket and then block
  // on a read of the socket. We will then attach the debugger to the specified
  // pid, and issue a write to the socket to indicate to the wrapper that the
  // attach is complete, and it's now OK to resume execution of the target.
  async _launchWrapperConnected(
    socket: Socket,
    data: string,
    launchInfo: LaunchTargetInfo,
  ): Promise<void> {
    // Expect the python wrapper to send us a pid.
    const pid = parseInt(data.trim(), 10);
    if (Number.isNaN(pid)) {
      throw new Error(
        'Failed to start debugger: Received invalid process ID from target wrapper',
      );
    }

    try {
      // Attach the debugger to the wrapper script process.
      await this.attach({
        pid,
        name: launchInfo.executablePath,
        commandName: launchInfo.executablePath,
        basepath: launchInfo.basepath,
      })
        .refCount()
        .toPromise();

      // Send any data into the socket to unblock the target wrapper
      // and let it know it's safe to proceed with launching now.
      socket.end('continue');
    } catch (e) {
      this._handleLLDBExit();
    }
  }

  async prepareForTerminalLaunch(
    launchInfo: LaunchTargetInfo,
  ): Promise<PrepareForLaunchResponse> {
    // Expand home directory if the launch executable starts with ~/
    launchInfo.executablePath = nuclideUri.expandHomeDir(
      launchInfo.executablePath,
    );

    const pythonBinaryPath =
      // flowlint-next-line sketchy-null-string:off
      this._config.pythonBinaryPath ||
      (await _getDefaultLLDBConfig()).pythonPath;

    // Find the launch wrapper.
    const wrapperScriptPath = nuclideUri.join(
      __dirname,
      '../scripts/launch.py',
    );

    const ipcPort = await this._spawnIpcServer(socket => {
      socket.once('data', async data => {
        this._launchWrapperConnected(socket, data.toString(), launchInfo);
      });
    });

    return {
      launchCommand: pythonBinaryPath,
      targetExecutable: launchInfo.executablePath,
      launchCwd: nuclideUri.expandHomeDir(
        launchInfo.workingDirectory !== '' ? launchInfo.workingDirectory : '~',
      ),
      launchArgs: [
        wrapperScriptPath,
        String(ipcPort),
        launchInfo.executablePath,
        ...launchInfo.arguments,
      ],
    };
  }
}
