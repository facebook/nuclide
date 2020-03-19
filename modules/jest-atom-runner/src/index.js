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

/* This is the main file that Jest will specify in its config as
 * 'runner': 'path/to/this/file'
 */

/* eslint-disable nuclide-internal/no-commonjs */

import type {IPCServer} from './ipc-server';
import type {GlobalConfig, Test, TestResult, Watcher} from './types';
import type {ServerID} from './utils';

import {startServer} from './ipc-server';
import {makeUniqServerId} from './utils';

import AtomTestWorkerFarm from './AtomTestWorkerFarm';

// Share ipc server and farm between multiple runs, so we don't restart
// the whole thing in watch mode every time. (it steals window focus when
// atom launches)
let ipcServerPromise;
let serverID;
let farm;
let cleanupRegistered = false;

class TestRunner {
  _globalConfig: GlobalConfig;
  _serverID: ServerID;
  _ipcServerPromise: Promise<IPCServer>;

  constructor(globalConfig: GlobalConfig) {
    this._globalConfig = globalConfig;
    serverID = serverID || (serverID = makeUniqServerId());
    ipcServerPromise ||
      (ipcServerPromise = startServer({
        serverID: this._serverID,
      }));
  }

  async runTests(
    tests: Array<Test>,
    watcher: Watcher,
    onStart: Test => void,
    onResult: (Test, TestResult) => void,
    onFailure: (Test, Error) => void,
    options: {},
  ) {
    const isWatch = this._globalConfig.watch || this._globalConfig.watchAll;
    const concurrency = isWatch
      ? // spawning multiple atoms in watch mode is weird,
        // they all try to steal focus from the current window
        1
      : Math.min(tests.length, this._globalConfig.maxWorkers);
    const ipcServer = await ipcServerPromise;
    if (!farm) {
      farm = new AtomTestWorkerFarm({
        serverID: this._serverID,
        ipcServer: await ipcServer,
        globalConfig: this._globalConfig,
        concurrency,
      });
      await farm.start();
    }

    const cleanup = async () => {
      farm.stop();
      ipcServer.stop();
    };

    if (!cleanupRegistered) {
      cleanupRegistered = true;
      process.on('exit', cleanup);
      process.on('SIGINT', cleanup);
      process.on('SIGUSR1', cleanup);
      process.on('SIGUSR2', cleanup);
      process.on('uncaughtException', cleanup);
    }

    await Promise.all(
      tests.map(test => {
        return farm
          .runTest(test, onStart)
          .then(testResult => onResult(test, testResult))
          .catch(error => onFailure(test, error));
      }),
    );

    if (!isWatch) {
      cleanup();
    }
  }
}

module.exports = TestRunner;
