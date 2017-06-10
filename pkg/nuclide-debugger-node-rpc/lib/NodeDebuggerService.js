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

import invariant from 'assert';
import {ConnectableObservable} from 'rxjs';
import WS from 'ws';
import {CompositeDisposable, Disposable} from 'event-kit';
import {runCommand} from 'nuclide-commons/process';
import logger from './utils';
import {ClientCallback} from '../../nuclide-debugger-common';
import {NodeDebuggerHost} from './NodeDebuggerHost';

export type NodeAttachTargetInfo = {
  pid: number,
  name: string,
  commandName: string,
};

export async function getAttachTargetInfoList(): Promise<
  Array<NodeAttachTargetInfo>,
> {
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
      // Filter out current process and only return node processes.
      return pidToCommand.has(pid) && pid !== process.pid && name === 'node';
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

export class NodeDebuggerService {
  _subscriptions: CompositeDisposable;
  _clientCallback: ClientCallback;
  _debuggerHost: NodeDebuggerHost;
  _webSocketClientToNode: ?WS;

  constructor() {
    this._clientCallback = new ClientCallback();
    this._debuggerHost = new NodeDebuggerHost();
    this._webSocketClientToNode = null;
    this._subscriptions = new CompositeDisposable(
      this._clientCallback,
      this._debuggerHost,
    );
  }

  getServerMessageObservable(): ConnectableObservable<string> {
    return this._clientCallback.getServerMessageObservable().publish();
  }

  async sendCommand(message: string): Promise<void> {
    const nodeWebSocket = this._webSocketClientToNode;
    if (nodeWebSocket != null) {
      logger.info(`forward client message to node debugger: ${message}`);
      nodeWebSocket.send(message);
    } else {
      logger.info(
        `Nuclide sent message to node debugger after socket closed: ${message}`,
      );
    }
  }

  async attach(attachInfo: NodeAttachTargetInfo): Promise<void> {
    // Enable debugging in the process.
    process.kill(attachInfo.pid, 'SIGUSR1');
    const serverAddress = this._debuggerHost.start();
    const websocket = await this._connectWithDebuggerHost(serverAddress);
    websocket.on('message', this._handleNodeDebuggerMessage.bind(this));
    websocket.on('close', this._handleNodeDebuggerClose.bind(this));
    this._webSocketClientToNode = websocket;
  }

  async _connectWithDebuggerHost(serverAddress: string): Promise<WS> {
    logger.info(`Connecting debugger host with address: ${serverAddress}`);
    const ws = new WS(serverAddress);
    this._subscriptions.add(new Disposable(() => ws.close()));
    return new Promise((resolve, reject) => {
      ws.on('open', () => {
        // Successfully connected with debugger host, fulfill the promise.
        resolve(ws);
      });
      ws.on('error', error => reject(error));
    });
  }

  _handleNodeDebuggerMessage(message: string): void {
    logger.info(`Node debugger message: ${message}`);
    this._clientCallback.sendChromeMessage(message);
  }

  _handleNodeDebuggerClose(): void {
    this.dispose();
  }

  async dispose(): Promise<void> {
    this._subscriptions.dispose();
  }
}
