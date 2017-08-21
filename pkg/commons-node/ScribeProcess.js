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

import child_process from 'child_process';
import os from 'os';
import {spawn} from 'nuclide-commons/process';
import once from './once';
// $FlowFixMe: Add EmptyError to type defs
import {EmptyError, Subject} from 'rxjs';

const DEFAULT_JOIN_TIMEOUT = 5000;
let SCRIBE_CAT_COMMAND = 'scribe_cat';

/**
 * A wrapper of `scribe_cat` (https://github.com/facebookarchive/scribe/blob/master/examples/scribe_cat)
 * command. User could call `new ScribeProcess($scribeCategoryName)` to create a process and then
 * call `scribeProcess.write($object)` to save an JSON schemaed Object into scribe category.
 * It will also recover from `scribe_cat` failure automatically.
 */
export default class ScribeProcess {
  _scribeCategory: string;
  _disposals: Subject<void>;
  _childPromise: ?Promise<child_process$ChildProcess>;
  _subscription: ?rxjs$ISubscription;

  constructor(scribeCategory: string) {
    this._disposals = new Subject();
    this._scribeCategory = scribeCategory;
    this._getChildProcess();
  }

  /**
   * Check if `scribe_cat` exists in PATH.
   */
  static isScribeCatOnPath = once(() => {
    try {
      const proc = child_process.spawnSync('which', [SCRIBE_CAT_COMMAND]);
      return proc.status === 0;
    } catch (e) {
      return false;
    }
  });

  /**
   * Write a string to a Scribe category.
   * Ensure newlines are properly escaped.
   */
  async write(message: string): Promise<void> {
    const child = await this._getChildProcess();
    await new Promise(resolve => {
      child.stdin.write(`${message}${os.EOL}`, resolve);
    });
  }

  async dispose(): Promise<void> {
    this._disposals.next();
    if (this._subscription != null) {
      this._childPromise = null;
      this._subscription.unsubscribe();
      this._subscription = null;
    }
  }

  /**
   * Waits for the remaining messages to be written, then closes the write stream. Resolves once the
   * process has exited. This method is called when the server shuts down in order to guarantee we
   * capture logging during shutdown.
   */
  async join(timeout: number = DEFAULT_JOIN_TIMEOUT): Promise<void> {
    if (this._childPromise == null) {
      return;
    }

    const {stdin} = await this._childPromise;
    // Make sure stdin has drained before ending it.
    if (!stdin.write(os.EOL)) {
      stdin.once('drain', () => stdin.end());
    } else {
      stdin.end();
    }
    if (this._childPromise == null) {
      return;
    }
    const child = await this._childPromise;
    await new Promise(resolve => {
      child.on('exit', () => {
        resolve();
      });
      setTimeout(resolve, timeout);
    });
  }

  _getChildProcess(): Promise<child_process$ChildProcess> {
    if (this._childPromise) {
      return this._childPromise;
    }

    // Kick off the process. Ideally we would store the subscription and unsubscribe when
    // `dispose()` was called. Practically, it probably doesn't matter since there's very little
    // chance we'd want to cancel before the process was ready.
    const processStream = spawn(SCRIBE_CAT_COMMAND, [this._scribeCategory])
      .do(child => {
        child.stdin.setDefaultEncoding('utf8');
      })
      .finally(() => {
        this._childPromise = null;
        this._subscription = null;
      })
      .publish();

    const childPromise = (this._childPromise = processStream
      .takeUntil(this._disposals)
      .first()
      .catch(err => {
        if (err instanceof EmptyError) {
          // Disposing before we have a process should send an error to anybody waiting on the
          // process promise.
          throw new Error('Disconnected before process was spawned');
        }
        throw err;
      })
      .toPromise());
    this._subscription = processStream.connect();
    return childPromise;
  }
}

export const __test__ = {
  setScribeCatCommand(newCommand: string): string {
    const originalCommand = SCRIBE_CAT_COMMAND;
    SCRIBE_CAT_COMMAND = newCommand;
    return originalCommand;
  },
};
