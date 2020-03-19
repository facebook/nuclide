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

import type {ConsoleLevel, ConsoleService} from 'atom-ide-ui';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import createPackage from 'nuclide-commons-atom/createPackage';

import sanitizeHtml from 'nuclide-commons/sanitizeHtml';

class Activation {
  _disposables: UniversalDisposable;

  constructor() {
    this._disposables = new UniversalDisposable();
    // This adds spaces after <p> elements, so if you do something like
    // <p>Hello.</p><p>Bye</p>
    // it will become "Hello. Bye." instead of "Hello.Bye."
  }

  consumeConsoleService(createConsole: ConsoleService): IDisposable {
    const consoleApi = createConsole({
      id: 'Atom',
      name: 'Atom',
    });
    const notificationDisposable = atom.notifications.onDidAddNotification(
      notification => {
        consoleApi.append({
          text: sanitizeHtml(notification.getMessage()),
          level: getLevel(notification.getType()),
        });
      },
    );
    this._disposables.add(consoleApi, notificationDisposable);
    return notificationDisposable;
  }

  dispose() {
    this._disposables.dispose();
  }
}

function getLevel(atomNotificationType: string): ConsoleLevel {
  switch (atomNotificationType) {
    case 'error':
    case 'fatal':
      return 'error';
    case 'info':
      return 'info';
    case 'warning':
      return 'warning';
    case 'success':
      return 'success';
    default:
      return 'log';
  }
}

createPackage(module.exports, Activation);
