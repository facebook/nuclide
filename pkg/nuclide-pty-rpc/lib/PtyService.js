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

import * as ptyFactory from 'nuclide-prebuilt-libs/pty';

import {getOriginalEnvironment} from 'nuclide-commons/process';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {objectFromMap} from 'nuclide-commons/collection';
import performanceNow from 'nuclide-commons/performanceNow';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {track} from '../../nuclide-analytics';

import {readConfig} from './shellConfig';

import type {Command, Pty, PtyInfo, PtyClient} from '../rpc-types';

export async function spawn(info: PtyInfo, client: PtyClient): Promise<Pty> {
  return new PtyImplementation(
    info,
    client,
    await getCommand(info, client),
    await getEnvironment(info),
  );
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
    client.onOutput(
      `Error reading ~/.nuclide-terminal.json:\r\n${error}\r\nStarting default '/bin/bash --login -i'\r\n`,
    );
  }

  if (process.platform === 'win32') {
    return {
      file: 'cmd.exe',
      args: [],
    };
  }

  // If no command and no local settings, default to /bin/bash --login -i.
  return {
    file: '/bin/bash',
    args: ['--login', '-i'],
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
    ...(info.environment != null ? objectFromMap(info.environment) : {}),
    TERM_PROGRAM: 'nuclide',
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
