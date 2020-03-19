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

/* An abstroction that acts as a sempaphore for Atom workers. */

/* eslint-disable nuclide-internal/no-commonjs */

import type {ServerID} from './utils';
import type {IPCServer} from './ipc-server';
import type {Test, GlobalConfig, TestResult} from './types';

import AtomTestWorker from './AtomTestWorker';

class AtomTestWorkerFarm {
  _workers: Array<AtomTestWorker>;
  _queue: Array<{
    test: Test,
    onStart: Test => void,
    resolve: TestResult => void,
    reject: Error => void,
  }>;

  constructor({
    ipcServer,
    serverID,
    globalConfig,
    concurrency,
  }: {
    ipcServer: IPCServer,
    serverID: ServerID,
    globalConfig: GlobalConfig,
    concurrency: number,
  }) {
    if (concurrency < 1) {
      throw new Error(
        `concurrency has to be greater than 1, given: ${concurrency}`,
      );
    }
    this._workers = [];
    this._queue = [];
    for (let i = 0; i < concurrency; i++) {
      const worker = new AtomTestWorker({ipcServer, serverID, globalConfig});
      this._workers.push(worker);
    }
  }

  async start() {
    await Promise.all(this._workers.map(w => w.start())).then(results =>
      results.forEach(() => this._processNext()),
    );
  }

  async stop() {
    await Promise.all(this._workers.map(w => w.stop()));
  }

  _processNext() {
    const availableWorker = this._workers.find(w => !w.isBusy());
    if (availableWorker) {
      const nextInQueue = this._queue.shift();
      if (nextInQueue) {
        nextInQueue.onStart(nextInQueue.test);
        availableWorker
          .runTest(nextInQueue.test)
          .then(testResult => {
            nextInQueue.resolve(testResult);
            this._processNext();
          })
          .catch(error => {
            nextInQueue.reject(error);
            this._processNext();
          });
      }
    }
  }

  runTest(test: Test, onStart: Test => void): Promise<TestResult> {
    return new Promise((resolve, reject) => {
      this._queue.push({test, resolve, reject, onStart});
      this._processNext();
    });
  }
}

export default AtomTestWorkerFarm;
