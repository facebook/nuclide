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

import type {NavigationStackService} from '../../nuclide-navigation-stack';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import createPackage from 'nuclide-commons-atom/createPackage';
import {ReplaySubject} from 'rxjs';
import {consumeStatusBar} from './StatusBar';

class Activation {
  _disposables: UniversalDisposable;
  _navigationStackSubject: ReplaySubject<?NavigationStackService>;

  constructor(state: ?Object) {
    this._disposables = new UniversalDisposable();
    this._navigationStackSubject = new ReplaySubject(1);
    this._disposables.add(this._navigationStackSubject);
  }

  consumeNavigationStack(navigationStack: NavigationStackService): IDisposable {
    this._navigationStackSubject.next(navigationStack);
    return new UniversalDisposable(() => {
      this._navigationStackSubject.next(null);
    });
  }

  consumeStatusBar(statusBar: atom$StatusBar): IDisposable {
    const disposable = consumeStatusBar(
      statusBar,
      this._navigationStackSubject,
    );
    this._disposables.add(disposable);
    return new UniversalDisposable(() => {
      disposable.dispose();
      this._disposables.remove(disposable);
    });
  }

  dispose() {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
