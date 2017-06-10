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

import type {Level, OutputService} from '../../nuclide-console/lib/types';

import {CompositeDisposable} from 'atom';
import createPackage from 'nuclide-commons-atom/createPackage';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';

class Activation {
  _disposables: CompositeDisposable;

  constructor() {
    this._disposables = new CompositeDisposable();
  }

  consumeOutputService(api: OutputService): void {
    const messages = observableFromSubscribeFunction(
      atom.notifications.onDidAddNotification.bind(atom.notifications),
    ).map(notification => ({
      // TODO (matthewwithanm): Add timestamp once nuclide-console supports it.
      // TODO (matthewwithanm): Show notification description/details.
      text: notification.getMessage(),
      level: getLevel(notification.getType()),
    }));

    this._disposables.add(api.registerOutputProvider({id: 'Atom', messages}));
  }

  dispose() {
    this._disposables.dispose();
  }
}

function getLevel(atomNotificationType: string): Level {
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
