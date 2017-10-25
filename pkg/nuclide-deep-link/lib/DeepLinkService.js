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
import invariant from 'assert';
import {Observable} from 'rxjs';
import querystring from 'querystring';
import url from 'url';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import SharedObservableCache from '../../commons-node/SharedObservableCache';

const {ipcRenderer, remote} = electron;
invariant(ipcRenderer != null && remote != null);

const CHANNEL = 'nuclide-url-open';
const WIN32_DEEP_LINK = process.platform === 'win32';

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

        if (WIN32_DEEP_LINK) {
          if (observer == null) {
            // No observer is subscribed to events for this path yet, save the
            // message and fire it later when a subscriber is added for the path.
            const pendingEvents = this._pendingEvents.get(message);
            if (pendingEvents != null) {
              pendingEvents.push(params);
            } else {
              this._pendingEvents.set(message, [params]);
            }
          }
        }
      }),
      () => this._observers.forEach(observer => observer.complete()),
    );

    // Special protocol handling on Windows. Atom's protocol handler does not get
    // invoked, so the way the argument is passed to atom looks like a regular file
    // open operation. To handle this, we register a file opener that looks for a
    // special Win32 protocol prefix (atom://nuclide-win32) that is prepended to the
    // real atom://nuclide URI that we're trying to open. When we see that, unpack
    // the real URI and send it as a deep link to the first opened Atom window.
    if (WIN32_DEEP_LINK) {
      this._registerWin32LinkHandler();
    }
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

    if (WIN32_DEEP_LINK) {
      // If there are pending events for this subscription path, return the
      // observable and then fire them.
      this._firePendingEventsWin32(path);
    }

    return result;
  }

  sendDeepLink(
    browserWindow: electron$BrowserWindow,
    path: string,
    params: DeepLinkParams,
  ): void {
    browserWindow.webContents.send(CHANNEL, {message: path, params});
    browserWindow.focus();
  }

  // Helpers for making deep links work on Windows.
  _registerWin32LinkHandler() {
    const win32Prefix = 'atom://nuclide-win32/';
    // $FlowIgnore
    remote.app.setAsDefaultProtocolClient('atom', 'cmd', [
      '/c',
      'atom',
      '"' + win32Prefix + '%1"',
    ]);
    this._disposable.add(
      atom.workspace.addOpener(uri => {
        const protocolPrefix = 'atom://nuclide/';
        if (uri.startsWith(win32Prefix + protocolPrefix)) {
          const {host, pathname, query} = url.parse(
            uri.substring(win32Prefix.length),
          );
          invariant(
            host === 'nuclide' && pathname != null && pathname !== '',
            `Invalid URL ${uri}`,
          );

          const message = pathname.substr(1);
          const params = querystring.parse(query || '');

          // Forward the command to the first open Atom window, if there is more than one.
          const currentWindow = remote.getCurrentWindow();
          const targetBlank = params.target === '_blank';
          const targetWindow = targetBlank
            ? currentWindow
            : remote.BrowserWindow
                .getAllWindows()
                .filter(browserWindow => browserWindow.isVisible())[0];
          if (targetWindow != null) {
            this.sendDeepLink(targetWindow, message, params);

            // If this is not the first instance of atom, close this window.
            if (
              targetWindow !== remote.getCurrentWindow() &&
              targetWindow !== currentWindow.getParentWindow()
            ) {
              // $FlowIgnore
              atom.close();
            }
          }

          const textEditor = atom.workspace.buildTextEditor({});
          setImmediate(() => textEditor.destroy());
          return textEditor;
        }
      }),
    );
  }

  _firePendingEventsWin32(path: string) {
    const pendingEvents = this._pendingEvents.get(path);
    if (pendingEvents != null) {
      for (const event of pendingEvents) {
        this.sendDeepLink(remote.getCurrentWindow(), path, event);
      }
      this._pendingEvents.delete(path);
    }
  }
}
