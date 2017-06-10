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

import type {
  ExecutorResponse,
  ExecutorResult,
  ExecutorRequest,
  RnMessage,
} from './types';
import type {ConnectableObservable} from 'rxjs';

import formatEnoentNotification
  from '../../../commons-atom/format-enoent-notification';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getLogger} from 'log4js';
import {executeRequests} from './executeRequests';
import {runApp} from './runApp';
import invariant from 'assert';
import {Observable, Subject, Subscription} from 'rxjs';

/**
 * Debugging React Native involves running two processes in parallel: the React Native app, which
 * runs in a simulator or device, and the executor, which executes JavaScript in a separate
 * processes (and which is ultimately the process we debug). On the React Native App site,
 * instructions are sent and results received via websocket. The executor, on the other hand,
 * receives the instructions, executes them in a worker process, and emits the results. The whole
 * thing, then, is one big loop.
 *
 * In our code, this is  modeled as streams of messages, with two transformations: one for the the
 * React Native app and one for the executor. The input of each is the output of the other.
 *
 *                               rnMessages -> executorRequests
 *
 *                         +-----------------------------------------+
 *                         |                                         |
 *                         |                                         v
 *                +--------+----------+                     +--------+----------+
 *                |                   |                     |                   |
 *                |                   |                     |                   |
 *                | React Native App  |                     |     Executor      |
 *                |                   |                     |                   |
 *                |     (runApp)      |                     | (executeRequests) |
 *                |                   |                     |                   |
 *                |                   |                     |                   |
 *                +--------+----------+                     +----------+--------+
 *                         ^                                           |
 *                         |                                           |
 *                         +-------------------------------------------+
 *
 *                             executorResults <- executorResponses
 *
 */
export class DebuggerProxyClient {
  _executorResponses: ConnectableObservable<ExecutorResponse>;
  _rnMessages: ConnectableObservable<RnMessage>;
  _pids: Observable<number>;
  _subscription: ?Subscription;

  constructor() {
    const executorResults: Subject<ExecutorResult> = new Subject();

    this._rnMessages = runApp(executorResults)
      .catch(err => {
        atom.notifications.addError(
          'There was an unexpected error with the React Native app',
          {
            stack: err.stack,
          },
        );
        return Observable.empty();
      })
      .finally(() => {
        this.disconnect();
      })
      .publish();

    // Messages with `$close` are special instructions and messages with `replyID` are cross-talk
    // from another executor (probably Chrome), so filter both out. Otherwise, the messages from RN
    // are forwarded as-is to the executor.
    const executorRequests: Observable<
      ExecutorRequest,
    > = this._rnMessages.filter(
      message => message.$close == null && message.replyID == null,
    );

    this._executorResponses = executeRequests(executorRequests)
      .catch(err => {
        if (err.code === 'ENOENT') {
          const {message, meta} = formatEnoentNotification({
            feature: 'React Native debugging',
            toolName: 'node',
            pathSetting: 'nuclide-react-native.pathToNode',
          });
          atom.notifications.addError(message, meta);
          return Observable.empty();
        }
        getLogger('nuclide-react-native').error(err);
        return Observable.empty();
      })
      .finally(() => {
        this.disconnect();
      })
      .publish();

    this._pids = this._executorResponses
      .filter(response => response.kind === 'pid')
      .map(response => {
        invariant(response.kind === 'pid');
        return response.pid;
      });

    // Send the executor results to the RN app. (Close the loop.)
    ((this._executorResponses.filter(
      response => response.kind === 'result',
    ): any): Observable<ExecutorResult>).subscribe(executorResults);

    // Disconnect when the RN app tells us to (via a specially-formatted message).
    this._rnMessages
      .filter(message => Boolean(message.$close))
      .subscribe(() => {
        this.disconnect();
      });

    // Log executor errors.
    this._executorResponses
      .filter(response => response.kind === 'error')
      .map(response => {
        invariant(response.kind === 'error');
        return response.message;
      })
      .subscribe(getLogger('nuclide-react-native').error);
  }

  connect(): void {
    if (this._subscription != null) {
      // We're already connecting.
      return;
    }

    const sub = new Subscription();

    sub.add(this._rnMessages.connect());

    sub.add(this._executorResponses.connect());

    // Null our subscription reference when the observable completes/errors. We'll use this to know
    // if it's running.
    sub.add(() => {
      this._subscription = null;
    });

    this._subscription = sub;
  }

  disconnect(): void {
    if (this._subscription == null) {
      return;
    }
    this._subscription.unsubscribe();
  }

  /**
   * An API for subscribing to the next worker process pid.
   */
  onDidEvalApplicationScript(callback: (pid: number) => mixed): IDisposable {
    return new UniversalDisposable(this._pids.subscribe(callback));
  }
}
