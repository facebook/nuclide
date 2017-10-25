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

import type {Message} from 'nuclide-commons/process';

import invariant from 'assert';
import {Emitter} from 'event-kit';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export default class ExampleTask {
  _emitter: Emitter = new Emitter();
  _completeTimeoutId: ?number;
  _messageIntervalId: ?number;
  _progressIntervalId: ?number;
  _progress: number;

  start = (): void => {
    invariant(this._completeTimeoutId == null);
    invariant(this._messageIntervalId == null);
    invariant(this._progressIntervalId == null);
    this._progress = 0;
    this._messageIntervalId = setInterval(this._handleMessageInterval, 3000);
    this._progressIntervalId = setInterval(this._handleProgrssInterval, 1000);
    this._completeTimeoutId = setTimeout(this._handleComplete, 15000);
  };

  cancel = (): void => {
    this._tearDown();
  };

  _handleMessageInterval = (): void => {
    this._emitter.emit('message', {
      level: 'info',
      text: `It is currently ${new Date().toString()}`,
    });
  };

  _handleProgrssInterval = (): void => {
    this._emitter.emit('progress', (this._progress += 0.05));
  };

  _handleComplete = (): void => {
    this._tearDown();
    this._emitter.emit('complete');
  };

  _tearDown = (): void => {
    if (this._messageIntervalId != null) {
      clearInterval(this._messageIntervalId);
    }
    if (this._progressIntervalId != null) {
      clearInterval(this._progressIntervalId);
    }
    if (this._completeTimeoutId != null) {
      clearInterval(this._completeTimeoutId);
    }
  };

  onDidComplete = (callback: () => mixed): IDisposable => {
    return this._emitter.on('complete', callback);
  };

  onDidError = (callback: (err: Error) => mixed): IDisposable => {
    // If your task can error make sure to do something here.
    return new UniversalDisposable();
  };

  onMessage = (callback: (message: Message) => mixed): IDisposable => {
    return this._emitter.on('message', callback);
  };

  onProgress = (callback: (progress: ?number) => mixed): IDisposable => {
    return this._emitter.on('progress', callback);
  };
}
