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

import electron from 'electron';
import fs from 'fs';
import invariant from 'assert';
// eslint-disable-next-line rulesdir/prefer-nuclide-uri
import path from 'path';
import temp from 'temp';
import {__test__} from '../lib/url-main';
import * as pkgJson from '../package.json';

import {getWindowLoadSettings} from '../pkg/commons-atom/window-load-settings';
import fsPromise from 'nuclide-commons/fsPromise';

const {
  getApplicationState,
  getAtomInitializerScript,
  acquireLock,
  releaseLock,
} = __test__;

const {remote} = electron;
invariant(remote != null);

temp.track();

// Simulates what Atom does when it creates a new BrowserWindow.
function createAtomWindow(urlToOpen: string) {
  const loadSettings = getWindowLoadSettings();
  // This has to be done in the main process now - there's no way to set loadSettings
  // via the proxied BrowserWindow object.
  const {createBrowserWindow} = remote.require(
    require.resolve('./utils/create-browser-window'),
  );
  return createBrowserWindow(
    {
      ...loadSettings,
      windowInitializationScript: require.resolve(
        path.join('..', pkgJson.urlMain),
      ),
      urlToOpen,
    },
    remote.getCurrentWindow(),
  );
}

describe('url-main', () => {
  it('sends a signal back to this window', () => {
    const spy = jasmine.createSpy('nuclide-url-open');
    let newWindow;

    runs(() => {
      invariant(electron.ipcRenderer);
      electron.ipcRenderer.on('nuclide-url-open', spy);
      newWindow = createAtomWindow('atom://nuclide/path?param=test');
    });

    waitsFor(() => spy.callCount === 1);

    runs(() => {
      expect(spy.calls[0].args[1]).toEqual({
        message: 'path',
        params: {param: 'test'},
      });
    });

    waitsFor(() => newWindow.isDestroyed(), 'the new window to be destroyed');
  });
});

describe('getApplicationState', () => {
  it('retrieves window state from storage/application.json', () => {
    const tmpdir = temp.mkdirSync();
    const storageDir = path.join(tmpdir, 'storage');
    fs.mkdirSync(storageDir);
    const mockState = [{initialPaths: ['test']}];
    fs.writeFileSync(
      path.join(storageDir, 'application.json'),
      JSON.stringify(mockState),
    );
    expect(getApplicationState(tmpdir)).toEqual(mockState);
  });
});

describe('getAtomInitializerScript', () => {
  it('points to a valid JS file', () => {
    waitsForPromise(async () => {
      expect(await fsPromise.exists(getAtomInitializerScript())).toBe(true);
    });
  });
});

describe('acquireLock/releaseLock', () => {
  beforeEach(() => {
    releaseLock();
  });

  afterEach(() => {
    releaseLock();
  });

  it('acts as a mutex', () => {
    expect(acquireLock()).toBe(true);
    expect(acquireLock()).toBe(false);
    releaseLock();
    expect(acquireLock()).toBe(true);
  });

  it('expires after a timeout', () => {
    expect(acquireLock()).toBe(true);
    advanceClock(10000);
    expect(acquireLock()).toBe(true);
  });
});
