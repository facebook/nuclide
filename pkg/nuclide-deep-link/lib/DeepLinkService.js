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
import type {BrowserWindow} from 'nuclide-commons/electron-remote';

import invariant from 'assert';
import url from 'url';
import {Observable} from 'rxjs';
import {maxBy} from 'lodash';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observeDeepLinks, sendDeepLink} from '../../commons-atom/deep-link';
import SharedObservableCache from '../../commons-node/SharedObservableCache';

const {ipcRenderer, remote} = electron;
invariant(ipcRenderer != null && remote != null);

// This function relies on each step being synchronous.
// May break in future Atom versions.
export function _openInNewWindow(uri: string): void {
  const windows = remote.BrowserWindow.getAllWindows();

  // First, open a new window.
  // There's no explicit API but we'll send the standard command.
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'application:new-window',
  );

  const newWindows = remote.BrowserWindow.getAllWindows();
  invariant(
    newWindows.length > windows.length,
    'Expected new window to appear',
  );

  // We'll assume the highest ID is new. (Electron IDs are auto-incrementing.)
  // (This is also non-null because the invariant above guarantees > 0).
  const newWindow = maxBy(newWindows, w => w.id);
  // Atom's definition of 'window:loaded' waits for all packages to load.
  // Thus, it's safe to send the URI after this point.
  // https://github.com/atom/atom/blob/910fbeee31d67eb711ec0771e7c26fa408c091eb/static/index.js#L106
  newWindow.once(('window:loaded': any), () => {
    // Needs to match sendURIMessage:
    // https://github.com/atom/atom/blob/d2d3ad9fb8a4aadb2fe0e53edf7d95bd109fc0f7/src/main-process/atom-window.js#L286
    newWindow.webContents.send('uri-message', uri);
  });
}

function isWindowBlank(lastDeepLinkUptime: ?number): boolean {
  // A window is considered empty if:
  // 1) it has no open projects
  // 2) it has no visible modal panels
  // 3) no deep link was opened recently
  const BLANK_DEEP_LINK_EXPIRY = 3;
  return (
    atom.project.getPaths().length === 0 &&
    !atom.workspace.getModalPanels().some(x => x.isVisible()) &&
    (lastDeepLinkUptime == null ||
      process.uptime() - lastDeepLinkUptime > BLANK_DEEP_LINK_EXPIRY)
  );
}

export default class DeepLinkService {
  _disposable: UniversalDisposable;
  _observers: Map<string, rxjs$Observer<DeepLinkParams>>;
  _observables: SharedObservableCache<string, DeepLinkParams>;
  _pendingEvents: Map<string, Array<Object>>;

  constructor() {
    this._observers = new Map();
    this._pendingEvents = new Map();
    this._observables = new SharedObservableCache(path => {
      return Observable.create(observer => {
        this._observers.set(path, observer);
        return () => this._observers.delete(path);
      }).share();
    });

    let lastDeepLinkUptime = null;
    this._disposable = new UniversalDisposable(
      observeDeepLinks().subscribe(({message, params}) => {
        // This is a special feature that mimics the browser's target=_blank.
        // Opens up a new Atom window and sends it back to the Atom URI handler.
        // If the current window is already 'blank' then we'll use the current one, though.
        if (params.target === '_blank' && !isWindowBlank(lastDeepLinkUptime)) {
          // Can't recurse indefinitely!
          const {target, ...paramsWithoutTarget} = params;
          _openInNewWindow(
            url.format({
              protocol: 'atom:',
              slashes: true,
              host: 'nuclide',
              pathname: message,
              query: paramsWithoutTarget,
            }),
          );
          return;
        }
        const path = message.replace(/\/+$/, '');
        const observer = this._observers.get(path);
        if (observer != null) {
          observer.next(params);
        }
        lastDeepLinkUptime = process.uptime();
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
    const result = new UniversalDisposable(
      this._observables.get(path).subscribe(callback),
    );

    return result;
  }

  sendDeepLink(
    browserWindow: BrowserWindow,
    path: string,
    params: DeepLinkParams,
  ): void {
    sendDeepLink(browserWindow, path, params);
    browserWindow.focus();
  }
}
