/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import fs from 'fs';
import invariant from 'assert';
import once from './once';
import semver from 'semver';
import os from 'os';
import nuclideUri from './nuclideUri';

// eslint-disable-next-line
const NUCLIDE_PACKAGE_JSON_PATH = require.resolve('../../package.json');
const NUCLIDE_BASEDIR = nuclideUri.dirname(NUCLIDE_PACKAGE_JSON_PATH);

const pkgJson = JSON.parse(fs.readFileSync(NUCLIDE_PACKAGE_JSON_PATH, 'utf8'));

export const OS_TYPE = {
  WIN32: 'win32',
  WIN64: 'win64',
  LINUX: 'linux',
  OSX: 'darwin',
};

const getMinorNuclideVersion = once(() => {
  const nuclideVersion = getNuclideVersion();
  const semVersion = semver.parse(nuclideVersion);
  invariant(semVersion != null);
  return `${semVersion.major}.${semVersion.minor}`;
});

export const NUCLIDE_VERSION_HEADER = {
  'Nuclide-Version': getMinorNuclideVersion(),
};

// Prior to Atom v1.7.0, `atom.inSpecMode` had a chance of performing an IPC call that could be
// expensive depending on how much work the other process was doing. Because this value will not
// change during run time, memoize the value to ensure the IPC call is performed only once.
//
// See [`getWindowLoadSettings`][1] for the sneaky getter and `remote` call that this memoization
// ensures happens only once.
//
// [1]: https://github.com/atom/atom/blob/v1.6.2/src/window-load-settings-helpers.coffee#L10-L14
// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const isRunningInTest = once(
  (): boolean => {
    try {
      if (typeof jest === 'object') {
        return true;
      }
    } catch (e) {}
    if (typeof atom === 'object') {
      return atom.inSpecMode();
    } else {
      return process.env.NODE_ENV === 'test';
    }
  },
);

// Nuclide code can run in one of three situations:
//
// 1) Inside of Atom (just checking the Atom global is enough)
// 2) Inside of a forked Atom Helper (which has ELECTRON_RUN_AS_NODE)
// 3) Inside of the Nuclide server, or another plain Node script
//
// It's hard to explicitly check 3) so this checks for the absence of 1/2.
export function isRunningInServer(): boolean {
  return (
    typeof atom === 'undefined' && process.env.ELECTRON_RUN_AS_NODE !== '1'
  );
}

// This path may be a symlink.
export function getAtomNuclideDir(): string {
  if (typeof atom !== 'object') {
    throw new Error('Not running in Atom.');
  }
  const nuclidePackageModule = atom.packages.getLoadedPackage('nuclide');
  invariant(nuclidePackageModule);
  return nuclidePackageModule.path;
}

export function getAtomVersion(): string {
  if (typeof atom !== 'object') {
    throw new Error('Not running in Atom.');
  }
  return atom.getVersion();
}

export function getNuclideVersion(): string {
  return pkgJson.version;
}

export function getNuclideRealDir(): string {
  return NUCLIDE_BASEDIR;
}

export function getOsType(): string {
  return os.platform();
}

export function isRunningInWindows(): boolean {
  return getOsType() === OS_TYPE.WIN32 || getOsType() === OS_TYPE.WIN64;
}

export function getOsVersion(): string {
  return os.release();
}

export function getRuntimePath(): string {
  // "resourcesPath" only exists in Atom. It's as close as you can get to
  // Atom's path. In the general case, it looks like this:
  // Mac: "/Applications/Atom.app/Contents/Resources"
  // Linux: "/usr/share/atom/resources"
  // Windows: "C:\\Users\\asuarez\\AppData\\Local\\atom\\app-1.6.2\\resources"
  //          "C:\Atom\resources"
  // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
  if (global.atom && typeof process.resourcesPath === 'string') {
    const resourcesPath = process.resourcesPath;
    if (os.platform() === 'darwin') {
      return resourcesPath.replace(/\/Contents\/Resources$/, '');
    } else if (os.platform() === 'linux') {
      return resourcesPath.replace(/\/resources$/, '');
    } else {
      return resourcesPath.replace(/[\\]+resources$/, '');
    }
  } else {
    return process.execPath;
  }
}
