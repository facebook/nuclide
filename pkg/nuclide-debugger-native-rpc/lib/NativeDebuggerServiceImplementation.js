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
} from './NativeDebuggerServiceInterface.js';

import child_process from 'child_process';
import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {DebuggerRpcWebSocketService} from '../../nuclide-debugger-common';
import {observeStream} from 'nuclide-commons/stream';
import {splitStream} from 'nuclide-commons/observable';
import {runCommand} from 'nuclide-commons/process';
import {Observable} from 'rxjs';

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
  processes.toString().split('\n').slice(1).forEach(line => {
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
  commands.toString().split('\n').slice(1).forEach(line => {
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

export class NativeDebuggerService extends DebuggerRpcWebSocketService {
  _config: DebuggerConfig;

  constructor(config: DebuggerConfig) {
    super('native');
    this._config = config;
    this.getLogger().setLevel(config.logLevel);
  }

  attach(attachInfo: AttachTargetInfo): ConnectableObservable<void> {
    this.getLogger().debug(`attach process: ${JSON.stringify(attachInfo)}`);
    const inferiorArguments = {
      pid: String(attachInfo.pid),
      basepath: attachInfo.basepath
        ? attachInfo.basepath
        : this._config.buckConfigRootFile,
      lldb_python_path: this._config.lldbPythonPath,
    };
    return Observable.fromPromise(
      this._startDebugging(inferiorArguments),
    ).publish();
  }

  launch(launchInfo: LaunchTargetInfo): ConnectableObservable<void> {
    this.getLogger().debug(`launch process: ${JSON.stringify(launchInfo)}`);
    const inferiorArguments = {
      executable_path: launchInfo.executablePath,
      launch_arguments: launchInfo.arguments,
      launch_environment_variables: launchInfo.environmentVariables,
      working_directory: launchInfo.workingDirectory,
      stdin_filepath: launchInfo.stdinFilePath ? launchInfo.stdinFilePath : '',
      basepath: launchInfo.basepath
        ? launchInfo.basepath
        : this._config.buckConfigRootFile,
      lldb_python_path: this._config.lldbPythonPath,
    };
    return Observable.fromPromise(
      this._startDebugging(inferiorArguments),
    ).publish();
  }

  bootstrap(bootstrapInfo: BootstrapDebuggerInfo): ConnectableObservable<void> {
    this.getLogger().debug(`bootstrap lldb: ${JSON.stringify(bootstrapInfo)}`);
    const inferiorArguments = {
      lldb_bootstrap_files: bootstrapInfo.lldbBootstrapFiles,
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
    const lldbProcess = this._spawnPythonBackend();
    lldbProcess.on('exit', this._handleLLDBExit.bind(this));
    this._registerIpcChannel(lldbProcess);
    this._sendArgumentsToPythonBackend(lldbProcess, inferiorArguments);
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

  _spawnPythonBackend(): child_process$ChildProcess {
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
    const lldbProcess = child_process.spawn(
      this._config.pythonBinaryPath,
      python_args,
      options,
    );
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
      observeStream(argumentsStream).first().subscribe(
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
}
