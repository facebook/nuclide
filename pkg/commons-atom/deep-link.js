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

import invariant from 'assert';
import electron from 'electron';
import {Observable} from 'rxjs';

import type {BrowserWindow} from 'nuclide-commons/electron-remote';

const {ipcRenderer, remote} = electron;
invariant(ipcRenderer != null, 'must be in renderer process');
invariant(remote != null);

const CHANNEL = 'nuclide-url-open';

let hasSentDeepLink = false;

export type DeepLinkMessage = {
  message: string,
  params: DeepLinkParams,
};

export type DeepLinkParams = {[key: string]: string | Array<string>};

export function observeDeepLinks(): Observable<DeepLinkMessage> {
  return Observable.fromEvent(ipcRenderer, CHANNEL, (event, data) => data);
}

export function sendDeepLink(
  browserWindow: BrowserWindow,
  path: string,
  params: Object,
): void {
  if (browserWindow === remote.getCurrentWindow()) {
    hasSentDeepLink = true;
  }

  browserWindow.webContents.send(CHANNEL, {message: path, params});
  browserWindow.focus();
}

export function getHasSentDeepLink(): boolean {
  return hasSentDeepLink;
}
