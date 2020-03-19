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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import formatEnoentNotification from '../../commons-atom/format-enoent-notification';
import {LogTailer} from '../../nuclide-console-base/lib/LogTailer';
import {createMessageStream} from './createMessageStream';
import {createProcessStream} from './createProcessStream';
import {Observable} from 'rxjs';

export default class Activation {
  _disposables: UniversalDisposable;
  _iosLogTailer: LogTailer;

  constructor(state: ?Object) {
    this._iosLogTailer = new LogTailer({
      name: 'iOS Simulator Logs',
      messages: Observable.defer(() =>
        createMessageStream(createProcessStream()),
      ),
      handleError(err) {
        if ((err: any).code === 'ENOENT') {
          const {message, meta} = formatEnoentNotification({
            feature: 'iOS Syslog tailing',
            toolName: 'syslog',
            pathSetting: 'nuclide-ios-simulator-logs.pathToSyslog',
          });
          atom.notifications.addError(message, meta);
          return;
        }
        throw err;
      },
      trackingEvents: {
        start: 'ios-simulator-logs:start',
        stop: 'ios-simulator-logs:stop',
        restart: 'ios-simulator-logs:restart',
      },
    });

    this._disposables = new UniversalDisposable(
      () => {
        this._iosLogTailer.stop();
      },
      atom.commands.add('atom-workspace', {
        'nuclide-ios-simulator-logs:start': () => this._iosLogTailer.start(),
        'nuclide-ios-simulator-logs:stop': () => this._iosLogTailer.stop(),
        'nuclide-ios-simulator-logs:restart': () =>
          this._iosLogTailer.restart(),
      }),
    );
  }

  consumeConsole(consoleService: ConsoleService): IDisposable {
    let consoleApi = consoleService({
      id: 'iOS Simulator Logs',
      name: 'iOS Simulator Logs',
      start: () => this._iosLogTailer.start(),
      stop: () => this._iosLogTailer.stop(),
    });
    const disposable = new UniversalDisposable(
      () => {
        consoleApi != null && consoleApi.dispose();
        consoleApi = null;
      },
      this._iosLogTailer
        .getMessages()
        .subscribe(message => consoleApi != null && consoleApi.append(message)),
      this._iosLogTailer.observeStatus(status => {
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
