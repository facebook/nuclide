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
import {remote} from 'electron';

invariant(remote != null);

/**
 * Equivalents of https://github.com/atom/atom/blob/master/src/get-window-load-settings.js
 */

export function getWindowLoadSettings(
  browserWindow: electron$BrowserWindow = remote.getCurrentWindow(),
): Object {
  // $FlowIgnore: add to defs when it comes.
  const {loadSettingsJSON} = browserWindow;
  return loadSettingsJSON != null
    ? // Atom 1.17+ only.
      JSON.parse(loadSettingsJSON)
    : // Atom 1.16.
      browserWindow.loadSettings || {};
}

export function setWindowLoadSettings(
  settings: Object,
  browserWindow: electron$BrowserWindow = remote.getCurrentWindow(),
): void {
  if (browserWindow.loadSettings) {
    browserWindow.loadSettings = settings;
  } else {
    // Atom 1.17+ only.
    // $FlowIgnore: add to defs when it comes.
    browserWindow.loadSettingsJSON = JSON.stringify(settings);
  }
}
