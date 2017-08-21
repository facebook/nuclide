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

import type {OutputService} from '../../nuclide-console/lib/types';

import formatEnoentNotification from '../../commons-atom/format-enoent-notification';
import {createProcessStream} from './createProcessStream';
import createMessageStream from './createMessageStream';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {LogTailer} from '../../nuclide-console/lib/LogTailer';
import {CompositeDisposable, Disposable} from 'atom';
import {Observable} from 'rxjs';

export default class Activation {
  _disposables: CompositeDisposable;
  _logTailer: LogTailer;

  constructor(state: ?Object) {
    const message$ = Observable.defer(() =>
      createMessageStream(
        createProcessStream()
          // Retry 3 times (unless we get a ENOENT)
          .retryWhen(errors =>
            errors.scan((errCount, err) => {
              if (isNoEntError(err) || errCount >= 2) {
                throw err;
              }
              return errCount + 1;
            }, 0),
          ),
      ),
    );

    this._logTailer = new LogTailer({
      name: 'adb Logcat',
      messages: message$,
      trackingEvents: {
        start: 'adb-logcat:start',
        stop: 'adb-logcat:stop',
        restart: 'adb-logcat:restart',
      },
      handleError(err) {
        if (isNoEntError(err)) {
          const {message, meta} = formatEnoentNotification({
            feature: 'Tailing Android (adb) logs',
            toolName: 'adb',
            pathSetting: 'nuclide-adb-logcat.pathToAdb',
          });
          atom.notifications.addError(message, meta);
          return;
        }
        throw err;
      },
    });

    this._disposables = new CompositeDisposable(
      new Disposable(() => {
        this._logTailer.stop();
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-adb-logcat:start': () => this._logTailer.start(),
        'nuclide-adb-logcat:stop': () => this._logTailer.stop(),
        'nuclide-adb-logcat:restart': () => this._logTailer.restart(),
      }),
    );
  }

  consumeOutputService(api: OutputService): void {
    this._disposables.add(
      api.registerOutputProvider({
        id: 'adb logcat',
        messages: this._logTailer.getMessages(),
        observeStatus: cb => this._logTailer.observeStatus(cb),
        start: () => {
          this._logTailer.start();
        },
        stop: () => {
          this._logTailer.stop();
        },
      }),
    );
  }

  dispose() {
    this._disposables.dispose();
  }
}

const isNoEntError = err => (err: any).code === 'ENOENT';
