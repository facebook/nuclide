/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @noflow
 * @format
 */
'use strict';

/* eslint nuclide-internal/no-commonjs: 0 */

// This code runs in the main process, so no transpiling!

const {BrowserWindow} = require('electron');
const path = require('path');
const url = require('url');

function createBrowserWindow(loadSettings, parent) {
  const newWindow = new BrowserWindow({show: false, parent});
  newWindow.loadSettings = loadSettings;
  newWindow.loadSettingsJSON = JSON.stringify(loadSettings);
  newWindow.loadURL(
    url.format({
      protocol: 'file',
      slashes: true,
      pathname: path.join(loadSettings.resourcePath, 'static/index.html'),
      // TODO(hansonw): Remove when Atom 1.15 is deployed.
      hash: encodeURIComponent(JSON.stringify(loadSettings)),
    }),
  );
  return newWindow;
}

module.exports = {createBrowserWindow};
