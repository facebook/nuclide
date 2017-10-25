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

/* eslint-disable no-console */

import type {ExitCode} from '../lib/types';

import invariant from 'assert';
import electron from 'electron';
// eslint-disable-next-line rulesdir/prefer-nuclide-uri
import path from 'path';

const {ipcRenderer, remote} = electron;
invariant(ipcRenderer != null && remote != null);

export default (async function runCommand(
  args: Array<string>,
): Promise<ExitCode> {
  if (typeof args[0] !== 'string') {
    console.error(`Usage: atom-script ${__filename} <spec file>`);
    return 1;
  }

  const initialWindows = remote.BrowserWindow.getAllWindows();

  const packageSpecPath = path.resolve(args[0]);
  ipcRenderer.send('run-package-specs', packageSpecPath);

  // Wait for the window to load
  await new Promise(resolve => setTimeout(resolve, 1000));

  const testWindow = remote.BrowserWindow
    .getAllWindows()
    .find(browserWindow => {
      return !initialWindows.includes(browserWindow);
    });

  if (testWindow == null) {
    console.error('Could not find spec browser window.');
    return 1;
  }

  // If we don't wait for the spec window to close before finishing, we cause
  // the window to close.
  await new Promise(resolve => {
    testWindow.once('close', () => {
      resolve();
    });
  });

  return 0;
});
