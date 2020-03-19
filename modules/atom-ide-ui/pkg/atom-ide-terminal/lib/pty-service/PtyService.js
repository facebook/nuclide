/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import fs from 'fs';
import fsPromise from 'nuclide-commons/fsPromise';
import * as ptyFactory from 'nuclide-prebuilt-libs/pty';

import os from 'os';
import {getOriginalEnvironment} from 'nuclide-commons/process';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {objectFromMap} from 'nuclide-commons/collection';
import performanceNow from 'nuclide-commons/performanceNow';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {track} from 'nuclide-commons/analytics';
import {runCommand} from 'nuclide-commons/process';

import {readConfig} from './shellConfig';

import type {Command, Pty, PtyInfo, PtyClient} from './rpc-types';

export async function spawn(info: PtyInfo, client: PtyClient): Promise<Pty> {
  return new PtyImplementation(
    info,
    client,
    await getCommand(info, client),
    await getEnvironment(info),
  );
}

export async function useTitleAsPath(client: PtyClient): Promise<boolean> {
  try {
    const config = await readConfig();
    // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
    if (config != null && config.useTitleAsPath != null) {
      return config.useTitleAsPath;
    }
  } catch (error) {
    client.onOutput(`Error reading ~/.nuclide-terminal.json:\r\n${error}\r\n`);
  }

  return false;
}

async function getCommand(info: PtyInfo, client: PtyClient): Promise<Command> {
  // Client-specified command is highest precedence.
  if (info.command != null) {
    return info.command;
  }

  // If no command, fall back to shell command specified in local
  // (server) config file.  This cannot be Atom config/preference,
  // since the default shell path varies between client and server.
  try {
    const config = await readConfig();
    if (config != null && config.command != null) {
      return config.command;
    }
  } catch (error) {
    client.onOutput(`Error reading ~/.nuclide-terminal.json:\r\n${error}\r\n`);
  }

  try {
    const defaultShellCommand = await getDefaultShellCommand();
    if (defaultShellCommand != null) {
      return defaultShellCommand;
    }
  } catch (error) {
    client.onOutput(`Error getting default shell:\r\n${error}\r\n`);
  }

  // If no command and no local settings, default to /bin/bash
  return {
    file: '/bin/bash',
    args: ['-l'],
  };
}

async function getDefaultShellCommand(): Promise<?Command> {
  if (process.platform === 'win32') {
    return {
      file: 'cmd.exe',
      args: [],
    };
  }

  const userInfo = os.userInfo();
  const username = userInfo.username;
  let defaultShell = null;
  if (process.platform === 'darwin') {
    const homedir = userInfo.homedir;
    const output = await runCommand('dscl', [
      '.',
      '-read',
      homedir,
      'UserShell',
    ]).toPromise();
    // Expected output looks like:
    //   UserShell: /bin/bash
    const prefix = 'UserShell: ';
    if (output != null && output.startsWith(prefix)) {
      defaultShell = output.substring(prefix.length).trim();
    }
  } else if (process.platform === 'linux') {
    const output = await runCommand('getent', ['passwd', username]).toPromise();
    // Expected output looks like:
    //   userid:*:1000:1000:Full Name:/home/userid:/bin/bash
    defaultShell = output.substring(output.lastIndexOf(':') + 1).trim();
  }
  if (defaultShell == null || defaultShell === '') {
    return null;
  }

  // Sanity check that the file exists and is executable
  const stat = await fsPromise.stat(defaultShell);
  // eslint-disable-next-line no-bitwise
  if ((stat.mode & fs.constants.S_IXOTH) === 0) {
    return null;
  }

  return {
    file: defaultShell,
    args: ['-l'],
  };
}

// variable defined in the original atom environment we want
// erased.
const filteredVariables = ['NODE_ENV', 'NODE_PATH'];

async function getEnvironment(info: PtyInfo): Promise<Object> {
  const newEnv = {...(await getOriginalEnvironment())};
  for (const x of filteredVariables) {
    delete newEnv[x];
  }
  return {
    ...newEnv,
    TERM_PROGRAM: 'nuclide',
    ...(info.environment != null ? objectFromMap(info.environment) : {}),
  };
}

export class PtyImplementation implements Pty {
  _subscriptions: UniversalDisposable;
  _pty: Object;
  _client: PtyClient;
  _initialization: {command: string, cwd: string};
  _startTime: number;
  _bytesIn: number;
  _bytesOut: number;

  constructor(info: PtyInfo, client: PtyClient, command: Command, env: Object) {
    this._startTime = performanceNow();
    this._bytesIn = 0;
    this._bytesOut = 0;
    this._initialization = {
      command: [command.file, ...command.args].join(' '),
      cwd: info.cwd != null ? info.cwd : '',
    };
    track('nuclide-pty-rpc.spawn', this._initialization);

    const subscriptions = (this._subscriptions = new UniversalDisposable());
    const pty = (this._pty = ptyFactory.spawn(command.file, command.args, {
      name: info.terminalType,
      cwd:
        info.cwd != null
          ? nuclideUri.expandHomeDir(info.cwd)
          : nuclideUri.expandHomeDir('~'),
      env,
    }));
    subscriptions.add(() => pty.destroy());
    // We need to dispose PtyClient here so that the client can GC the client.
    // (Otherwise, Nuclide's RPC framework will keep it around forever).
    // This is a bit of a weird flow where
    // 1) PtyClient gets disposed, which triggers this.dispose
    // 2) this.dispose triggers PtyClient.dispose
    // so make sure that double-disposing PtyClient is OK.
    subscriptions.add(client);
    this._client = client;

    const onOutput = this._onOutput.bind(this);
    pty.addListener('data', onOutput);
    subscriptions.add(() => pty.removeListener('data', onOutput));

    const onExit = this._onExit.bind(this);
    pty.addListener('exit', onExit);
    subscriptions.add(() => pty.removeListener('exit', onExit));
  }

  _onOutput(data: string): void {
    this._bytesOut += data.length;
    this._client.onOutput(data);
  }

  _onExit(code: number, signal: number): void {
    track('nuclide-pty-rpc.on-exit', {
      ...this._initialization,
      bytesIn: String(this._bytesIn),
      bytesOut: String(this._bytesOut),
      duration: String((performanceNow() - this._startTime) / 1000),
      exitCode: String(code),
      signal: String(code),
    });
    this._client.onExit(code, signal);
  }

  dispose(): void {
    this._subscriptions.dispose();
  }

  resize(columns: number, rows: number): void {
    if (this._pty.writable) {
      this._pty.resize(columns, rows);
    }
  }

  writeInput(data: string): void {
    if (this._pty.writable) {
      this._bytesIn += data.length;
      this._pty.write(data);
    }
  }
}
