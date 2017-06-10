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

import type {Level, ConsoleService} from '../../nuclide-console/lib/types';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import createPackage from 'nuclide-commons-atom/createPackage';
import {
  getNuclideConsoleMessages,
} from '../../nuclide-logging/lib/nuclideConsoleAppender';

class Activation {
  _disposables: UniversalDisposable;

  constructor() {
    this._disposables = new UniversalDisposable();
  }

  consumeConsole(getConsole: ConsoleService): IDisposable {
    const console = getConsole({
      id: 'Nuclide',
      name: 'Nuclide',
    });
    const disposable = new UniversalDisposable(
      getNuclideConsoleMessages()
        .map(loggingEvent => ({
          text: String(loggingEvent.data),
          level: getLevel(loggingEvent.level),
        }))
        .subscribe(message => {
          console.append(message);
        }),
    );

    // If this package is disabled, stop producing messages and dispose of the console we created.
    this._disposables.add(disposable, console);

    // If the console package goes away, stop producing messages.
    return disposable;
  }

  dispose() {
    this._disposables.dispose();
  }
}

function getLevel(atomNotificationType: string): Level {
  switch (atomNotificationType) {
    case 'debug':
    case 'error':
    case 'info':
      return atomNotificationType;
    case 'warn':
      return 'warning';
    default:
      return 'log';
  }
}

createPackage(module.exports, Activation);
