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

import {default as Deque} from 'double-ended-queue';
import EventEmitter from 'events';

type Executor<T> = () => Promise<T>;

/**
 * A pool that executes Promise executors in parallel given the poolSize, in order.
 *
 * The executor function passed to the constructor of a Promise is evaluated
 * immediately. This may not always be desirable. Use a PromisePool if you have
 * a sequence of async operations that need to be run in parallel and you also want
 * control the number of concurrent executions.
 */
export class PromisePool {
  _fifo: Deque<{id: string, executor: Executor<any>}>;
  _emitter: EventEmitter;
  _numPromisesRunning: number;
  _poolSize: number;
  _nextRequestId: number;

  constructor(poolSize: number) {
    this._fifo = new Deque();
    this._emitter = new EventEmitter();
    this._numPromisesRunning = 0;
    this._poolSize = poolSize;
    this._nextRequestId = 1;
  }

  /**
   * @param executor A function that takes resolve and reject callbacks, just
   *     like the Promise constructor.
   * @return A Promise that will be resolved/rejected in response to the
   *     execution of the executor.
   */
  submit<T>(executor: Executor<T>): Promise<T> {
    const id = this._getNextRequestId();
    this._fifo.push({id, executor});
    const promise = new Promise((resolve, reject) => {
      this._emitter.once(id, result => {
        const {isSuccess, value} = result;
        (isSuccess ? resolve : reject)(value);
      });
    });
    this._run();
    return promise;
  }

  _run() {
    if (this._numPromisesRunning === this._poolSize) {
      return;
    }

    const first = this._fifo.shift();
    if (first == null) {
      return;
    }

    const {id, executor} = first;
    this._numPromisesRunning++;

    executor().then(
      result => {
        this._emitter.emit(id, {isSuccess: true, value: result});
        this._numPromisesRunning--;
        this._run();
      },
      error => {
        this._emitter.emit(id, {isSuccess: false, value: error});
        this._numPromisesRunning--;
        this._run();
      },
    );
  }

  _getNextRequestId(): string {
    return (this._nextRequestId++).toString(16);
  }
}

/**
 * FIFO queue that executes Promise executors one at a time, in order.
 *
 * The executor function passed to the constructor of a Promise is evaluated
 * immediately. This may not always be desirable. Use a PromiseQueue if you have
 * a sequence of async operations that need to use a shared resource serially.
 */
export class PromiseQueue {
  _promisePool: PromisePool;

  constructor() {
    this._promisePool = new PromisePool(1);
  }

  /**
   * @param executor A function that takes resolve and reject callbacks, just
   *     like the Promise constructor.
   * @return A Promise that will be resolved/rejected in response to the
   *     execution of the executor.
   */
  submit<T>(executor: Executor<T>): Promise<T> {
    return this._promisePool.submit(executor);
  }
}
