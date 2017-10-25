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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import formatEnoentNotification from '../../commons-atom/format-enoent-notification';
// eslint-disable-next-line rulesdir/no-cross-atom-imports
import {LogTailer} from '../../nuclide-console/lib/LogTailer';
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

  consumeOutputService(api: OutputService): void {
    this._disposables.add(
      api.registerOutputProvider({
        id: 'iOS Simulator Logs',
        messages: this._iosLogTailer.getMessages(),
        observeStatus: cb => this._iosLogTailer.observeStatus(cb),
        start: () => {
          this._iosLogTailer.start();
        },
        stop: () => {
          this._iosLogTailer.stop();
        },
      }),
    );
  }

  dispose() {
    this._disposables.dispose();
  }
}
