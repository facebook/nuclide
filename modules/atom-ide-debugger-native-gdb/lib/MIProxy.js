/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import * as child_process from 'child_process';

import invariant from 'assert';
import {logVerbose} from './Logger';

import MILineParser from './MILineParser';
import {
  MIAsyncRecord,
  MIRecord,
  MIResultRecord,
  MIStreamRecord,
} from './MIRecord';

export type StreamTarget = 'console' | 'target' | 'log';

import EventEmitter from 'events';

type PendingCommand = {
  command: string,
  resolve: (result: MIResultRecord) => void,
};

export default class MIProxy extends EventEmitter {
  _miServer: ?child_process$ChildProcess;
  _parser: MILineParser;
  _lastPartialString: string;
  _nextToken: number;
  _pendingCommands: Map<number, PendingCommand>;

  _pendingRawCommandResolve: ?() => void;

  constructor() {
    super();

    this._parser = new MILineParser();
    this._nextToken = 1;
    this._lastPartialString = '';
    this._pendingCommands = new Map();
  }

  isConnected(): boolean {
    return this._miServer != null;
  }

  start(
    executable: string,
    args: Array<string>,
    env: ?{[string]: string},
  ): void {
    if (this._miServer != null) {
      this.stop();
    }

    let options = {};
    if (env != null) {
      options = {
        ...options,
        env: {
          ...process.env,
          ...env,
        },
      };
    }

    const proc = child_process.spawn(executable, args, options);
    this._miServer = proc;

    proc.stdout.on('data', (buffer: Buffer) => this._onData(buffer));
    proc.on('error', err => {
      this.emit('error', err);
    });
    proc.on('exit', () => {
      this.emit('exit');
    });
  }

  pause(): void {
    const server = this._miServer;
    if (server == null) {
      return;
    }

    server.kill('SIGINT');
  }

  stop(): void {
    if (this._miServer != null) {
      this._miServer.disconnect();
      this._miServer = null;
    }
  }

  async sendCommand(command: string): Promise<MIResultRecord> {
    return new Promise((resolve, reject) => {
      const dbg = this._miServer;
      if (dbg == null) {
        reject(
          new Error('Attempt to send a command when no MI server connected'),
        );
        return;
      }

      const token = this._nextToken++;
      const pendingCommand: PendingCommand = {
        command,
        token,
        resolve: (record: MIResultRecord) => {},
      };
      pendingCommand.resolve = resolve;
      this._pendingCommands.set(token, pendingCommand);
      const tokenizedCommand = `${token}-${command}\n`;
      logVerbose(`MIProxy sending command '${tokenizedCommand}' to server`);
      dbg.stdin.write(tokenizedCommand);
    });
  }

  async sendRawCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const dbg = this._miServer;
      if (dbg == null) {
        reject(
          new Error('Attempt to send a command when no MI server connected'),
        );
        return;
      }

      // We're making the assumption here that if we've stopped gdb at the prompt
      // and sent a real gdb (not MI) command, that it will execute synchronously
      // with no intermixed MI traffic.
      this._pendingRawCommandResolve = resolve;
      dbg.stdin.write(`${command}\n`);
    });
  }

  _onData(buffer: Buffer): void {
    // NB data coming back from gdb will be ASCII, and data from the target
    // does not come over this channel.
    const str: string = this._lastPartialString + buffer.toString('ASCII');

    const tailSplit: number = str.lastIndexOf('\n');
    if (tailSplit === -1) {
      this._lastPartialString = str;
      return;
    }

    this._lastPartialString = str.substr(tailSplit + 1);
    str
      .substr(0, tailSplit)
      .split('\n')
      .forEach((line: string) => this._onLine(line.trim()));
  }

  _onLine(line: string): void {
    if (line === '') {
      return;
    }

    logVerbose(`proxy received line ${line}`);
    const parsed = this._parser.parseMILine(line);
    this._emitRecord(parsed, line);
  }

  _emitRecord(record: MIRecord, line: string): void {
    if (record instanceof MIResultRecord) {
      const token = record.token;
      // if we have a raw gdb command, it won't have an associated token
      const rawResolve = this._pendingRawCommandResolve;
      if (token == null && rawResolve != null) {
        rawResolve();
        this._pendingRawCommandResolve = null;
        return;
      }

      invariant(token != null, 'token should always exist in a result record');
      const pending = this._pendingCommands.get(token);
      if (pending != null) {
        pending.resolve(record);
        this._pendingCommands.delete(token);
        return;
      }
      logVerbose(
        `Received response with token ${token} which matches no pending command`,
      );
    }

    if (record instanceof MIAsyncRecord) {
      this.emit('async', record);
    } else if (record instanceof MIStreamRecord) {
      if (!this._hackForAttachPermissions(record)) {
        this.emit('stream', record);
      }
    }
  }

  _hackForAttachPermissions(record: MIStreamRecord): boolean {
    if (record.streamTarget !== 'log') {
      return false;
    }

    if (record.text.match(/Could not attach to process/i) == null) {
      return false;
    }

    const attach = [...this._pendingCommands].find(
      _ => _[1].command.match(/target-attach/) != null,
    );

    if (attach == null) {
      return false;
    }

    const [token, command] = attach;

    // Modern versions of linux default to a locked down security model for
    // ptrace where ptrace can only attach to a child process. A sysctl call
    // must be made in order to get the old behavior, which gdb target-attach
    // depends on, of being able to ptrace any process owned by the user.
    // Unfortunately the target-attach command does not send back a proper
    // MI failure in this case; it prints a message to the log saying how
    // to fix the problem but the command never actually completes. Hence
    // this hack...
    const failure = new MIResultRecord(
      token,
      {msg: record.text.replace('\n', ' ')},
      'error',
    );
    command.resolve(failure);
    this._pendingCommands.delete(token);

    return true;
  }
}
