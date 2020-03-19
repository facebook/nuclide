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
import type {ProcessMessage} from 'nuclide-commons/process';
import type {Subscription} from 'rxjs';

// $FlowIgnore
import ProcessWatcher_types from './gen-nodejs/ProcessWatcher_types';
import {
  ProcessExitError,
  ProcessSystemError,
  MaxBufferExceededError,
  ProcessTimeoutError,
} from 'nuclide-commons/process';
import {Observable, Subject} from 'rxjs';
import {getLogger} from 'log4js';
import {observeProcess} from 'nuclide-commons/process';

const logger = getLogger('thrift-process-watcher-handler');

type ProcessMeta = {
  messages: Array<ProcessMessage>,
  subscription: Subscription,
  resolveLongPoll: ?(Array<ProcessMessage>) => void,
  longPollTimeoutId: ?TimeoutID,
};

export class ThriftProcessWatcherServiceHandler {
  _processes: Map<number, ProcessMeta>;
  _numObservedProcesses: number;

  constructor() {
    this._numObservedProcesses = 0;
    this._processes = new Map();
  }

  dispose() {
    this._processes.forEach((meta, id) => {
      this.unsubscribe(id);
    });
  }

  async nextMessages(
    processId: number,
    waitTimeSec: number,
  ): Promise<Array<ProcessWatcher_types.ProcessWatcherMessage>> {
    const meta = this._requireProcessMeta(processId);

    let messages = [];
    if (this._hasQueuedMessages(processId)) {
      messages = meta.messages;
      this._clearQueuedMessages(processId);
    } else {
      messages = await this._waitForNewMessages(processId, waitTimeSec);
    }

    if (this._lastMessageExits(messages)) {
      this._deleteProcessMeta(processId);
    }

    return messages;
  }

  unsubscribe(id: number): void {
    const meta = this._getProcessMeta(id);
    if (meta && meta.subscription) {
      logger.info('unsubscribing process with watcher id', id);
      if (meta.subscription) {
        meta.subscription.unsubscribe();
        this._enqueueProcessMessage(
          {kind: 'exit', exitCode: 1, signal: 'SIGKILL'},
          id,
        );
      }
    }
    this._deleteProcessMeta(id);
  }

  watchProcess(cmd: string, cmdArgs: Array<string>): number {
    const id = this._numObservedProcesses;
    this._numObservedProcesses++;

    const input = new Subject();
    const observable = observeProcess(cmd, cmdArgs, {
      isExitError: () => false,
      detached: false,
      killTreeWhenDone: true,
      env: process.env,
      dontLogInNuclide: true,
      input,
    }).catch(error => {
      const exitCode = error.exitCode ?? 1;
      const signal = error.signal;

      // emit synthetic events
      return Observable.of(
        {kind: 'stderr', data: this._getErrorMessage(error)},
        {kind: 'exit', exitCode, signal},
      );
    });

    const meta: ProcessMeta = {
      messages: [],
      subscription: observable.subscribe(message => {
        this._enqueueProcessMessage(message, id);
      }),
      resolveLongPoll: null,
      longPollTimeoutId: null,
      // input // TODO
    };
    this._processes.set(id, meta);

    return id;
  }

  _getErrorMessage(
    error:
      | ProcessExitError
      | ProcessSystemError
      | MaxBufferExceededError
      | ProcessTimeoutError,
  ) {
    return (
      [
        'name',
        'exitCode',
        'signal',
        'command',
        'args',
        'errno',
        'code',
        'path',
        'syscall',
      ]
        .map((prop: string) => {
          // $FlowIgnore
          if (error[prop] != null) {
            return `${prop}: ${error[prop]}`;
          } else {
            return null;
          }
        })
        .filter(el => el != null)
        .join('\n') + '\n'
    );
  }

  _clearQueuedMessages(processId: number) {
    const meta = this._requireProcessMeta(processId);
    meta.messages = [];
  }

  _hasQueuedMessages(processId: number) {
    const meta = this._requireProcessMeta(processId);
    return meta.messages.length > 0;
  }

  _lastMessageExits(messages: Array<ProcessMessage>) {
    const lastIndex = messages.length - 1;
    if (messages[lastIndex]) {
      return messages[lastIndex].kind === 'exit';
    }
    return false;
  }

  _deleteProcessMeta(id: number) {
    this._processes.delete(id);
  }

  _enqueueProcessMessage = (msg: ProcessMessage, id: number): void => {
    const meta = this._getProcessMeta(id);
    if (!meta) {
      logger.error('got new message', msg, 'for deleted process', id);
      return;
    }

    if (meta.resolveLongPoll) {
      this._resolveLongPoll(id, [msg]);
    } else {
      meta.messages.push(msg);
    }
  };

  _resolveLongPoll(id: number, msgs: Array<ProcessMessage>) {
    const meta = this._requireProcessMeta(id);
    if (meta.resolveLongPoll) {
      meta.resolveLongPoll(msgs);
    } else {
      throw new Error('long poll cannot be resolved for process with id ' + id);
    }
    if (meta.longPollTimeoutId != null) {
      clearTimeout(meta.longPollTimeoutId);
    }
    meta.resolveLongPoll = null;
  }

  async _waitForNewMessages(
    processId: number,
    waitTimeSec: number,
  ): Promise<Array<ProcessMessage>> {
    const SEC_TO_MSEC = 1000;
    return new Promise((resolveLongPoll, rejectLongPoll) => {
      const meta = this._requireProcessMeta(processId);
      if (meta.resolveLongPoll) {
        throw new Error('Processes cannot have multiple watchers');
      }

      meta.resolveLongPoll = resolveLongPoll;
      meta.longPollTimeoutId = setTimeout(() => {
        this._resolveLongPoll(processId, []);
      }, waitTimeSec * SEC_TO_MSEC);
    });
  }

  _getProcessMeta(id: number): ?ProcessMeta {
    return this._processes.get(id);
  }

  _requireProcessMeta(id: number): ProcessMeta {
    const meta = this._processes.get(id);
    if (!meta) {
      throw new Error('no process exists with id ' + id);
    }
    return meta;
  }
}
