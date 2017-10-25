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
import {Observable, Subject} from 'rxjs';
import {consumeStatusBar} from './StatusBar';

class Activation {
  _disposables: UniversalDisposable;
  _statusBarSubject: Subject<atom$StatusBar>;
  _navigationStackSubject: Subject<NavigationStackService>;

  constructor(state: ?Object) {
    this._disposables = new UniversalDisposable();
    this._statusBarSubject = new Subject();
    this._navigationStackSubject = new Subject();

    const serviceSubscription = Observable.combineLatest(
      this._statusBarSubject,
      this._navigationStackSubject,
    ).subscribe(([statusBar, stack]) => {
      this._disposables.add(consumeStatusBar(statusBar, stack));
    });
    this._disposables.add(
      this._statusBarSubject,
      this._navigationStackSubject,
      serviceSubscription,
    );
  }

  consumeNavigationStack(navigationStack: NavigationStackService): IDisposable {
    this._navigationStackSubject.next(navigationStack);
    this._navigationStackSubject.complete();
    return this._disposables;
  }

  consumeStatusBar(statusBar: atom$StatusBar): IDisposable {
    this._statusBarSubject.next(statusBar);
    this._statusBarSubject.complete();
    return this._disposables;
  }

  dispose() {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
