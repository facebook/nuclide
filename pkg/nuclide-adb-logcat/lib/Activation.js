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

import type {ConsoleService} from 'atom-ide-ui';

import formatEnoentNotification from '../../commons-atom/format-enoent-notification';
import {createProcessStream} from './createProcessStream';
import createMessageStream from './createMessageStream';
import {LogTailer} from '../../nuclide-console-base/lib/LogTailer';
import {Observable} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export default class Activation {
  _disposables: UniversalDisposable;
  _logTailer: LogTailer;

  constructor(state: ?Object) {
    const messages = Observable.defer(() =>
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
      messages,
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

    this._disposables = new UniversalDisposable(
      () => {
        this._logTailer.stop();
      },
      atom.commands.add('atom-workspace', {
        'nuclide-adb-logcat:start': () => this._logTailer.start(),
        'nuclide-adb-logcat:stop': () => this._logTailer.stop(),
        'nuclide-adb-logcat:restart': () => this._logTailer.restart(),
      }),
    );
  }

  consumeConsole(consoleService: ConsoleService): IDisposable {
    let consoleApi = consoleService({
      id: 'adb logcat',
      name: 'adb logcat',
      start: () => this._logTailer.start(),
      stop: () => this._logTailer.stop(),
    });
    const disposable = new UniversalDisposable(
      () => {
        consoleApi != null && consoleApi.dispose();
        consoleApi = null;
      },
      this._logTailer
        .getMessages()
        .subscribe(message => consoleApi != null && consoleApi.append(message)),
      this._logTailer.observeStatus(status => {
        if (consoleApi != null) {
          consoleApi.setStatus(status);
        }
      }),
    );
    this._disposables.add(disposable);
    return disposable;
  }

  dispose() {
    this._disposables.dispose();
  }
}

const isNoEntError = err => (err: any).code === 'ENOENT';
