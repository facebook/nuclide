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

import type {DeepLinkParams} from './types';

import electron from 'electron';
import invariant from 'invariant';
import {Observable} from 'rxjs';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import SharedObservableCache from '../../commons-node/SharedObservableCache';

const {ipcRenderer} = electron;
invariant(ipcRenderer != null);

const CHANNEL = 'nuclide-url-open';

export default class DeepLinkService {
  _disposable: UniversalDisposable;
  _observers: Map<string, rxjs$Observer<DeepLinkParams>>;
  _observables: SharedObservableCache<string, DeepLinkParams>;

  constructor() {
    this._observers = new Map();
    this._observables = new SharedObservableCache(path => {
      return Observable.create(observer => {
        this._observers.set(path, observer);
        return () => this._observers.delete(path);
      }).share();
    });

    this._disposable = new UniversalDisposable(
      // These events will be sent from lib/url-main.js.
      // TODO: Use real Atom URI handler from
      // https://github.com/atom/atom/pull/11399.
      Observable.fromEvent(
        ipcRenderer,
        CHANNEL,
        (event, data) => data,
      ).subscribe(({message, params}) => {
        const path = message.replace(/\/+$/, '');
        const observer = this._observers.get(path);
        if (observer != null) {
          observer.next(params);
        }
      }),
      () => this._observers.forEach(observer => observer.complete()),
    );
  }

  dispose(): void {
    this._disposable.dispose();
  }

  subscribeToPath(
    path: string,
    callback: (params: DeepLinkParams) => mixed,
  ): IDisposable {
    return new UniversalDisposable(
      this._observables.get(path).subscribe(callback),
    );
  }

  sendDeepLink(
    browserWindow: electron$BrowserWindow,
    path: string,
    params: DeepLinkParams,
  ): void {
    browserWindow.webContents.send(CHANNEL, {message: path, params});
    browserWindow.focus();
  }
}
