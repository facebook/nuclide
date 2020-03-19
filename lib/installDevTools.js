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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import electron from 'electron';
import invariant from 'assert';
import os from 'os';
import nuclideUri from 'nuclide-commons/nuclideUri';
import fs from 'fs';
import nullthrows from 'nullthrows';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import ReactDevPerfMonitor from './ReactDevPerfMonitor';

const extensionIDsToLoad = [
  // React DevTools
  'fmkadmapgofadopljbjfkapdkoienihi',
];

// eslint-disable-next-line no-console
const log = console.debug || console.log;

let installed;
export default function installDevTools(): IDisposable {
  const disposable = new UniversalDisposable(new ReactDevPerfMonitor());

  if (installed) {
    return disposable;
  }

  const chromeHome = getChromeHomeDir();
  const profileDirs = getProfileDirs(chromeHome);
  nullthrows(electron.webFrame).registerURLSchemeAsBypassingCSP(
    'chrome-extension',
  );
  const remote = nullthrows(electron.remote);

  for (const extensionID of extensionIDsToLoad) {
    remote.BrowserWindow.removeDevToolsExtension(extensionID);
    const extensionVersions = getVersionDirsForExtension(
      profileDirs,
      extensionID,
    );

    if (extensionVersions == null || extensionVersions.length === 0) {
      log(
        `Unable to load extension ${extensionID}. Make sure it is installed in one of your Chrome profiles.`,
      );
      continue;
    }

    const namesWithTimes = extensionVersions.map(dirname => ({
      ...fs.statSync(dirname),
      dirname,
    }));

    const latest = namesWithTimes.sort((a, b) => a.mtimeMs - b.mtimeMs)[0];
    let latestManifest: ?{name: string};
    try {
      latestManifest = JSON.parse(
        fs.readFileSync(
          nuclideUri.join(latest.dirname, 'manifest.json'),
          'utf-8',
        ),
      );
    } catch (e) {
      log(
        `Unable to read or parse a valid manifest for extension ${extensionID}`,
      );
    }

    if (latest != null && latestManifest != null) {
      try {
        remote.BrowserWindow.addDevToolsExtension(latest.dirname);
        log(
          `Successfully loaded Chrome extension "${latestManifest.name} - ${
            latest.dirname
          }"`,
        );
      } catch (e) {
        // the above call to `addDevToolsExtension` seems to frequently throw after
        // a recent Electron upgrade, despite the extension actually being added
      }
    }
  }

  installed = true;
  return disposable;
}

function getChromeHomeDir(): NuclideUri {
  switch (process.platform) {
    case 'darwin':
      return nuclideUri.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Google',
        'Chrome',
      );
    case 'win32':
      invariant(process.env.LOCALAPPDATA != null);
      return nuclideUri.join(
        process.env.LOCALAPPDATA,
        'Google',
        'Chrome',
        'User Data',
      );
    default:
      return nuclideUri.join(os.homedir(), '.config', 'google-chrome');
  }
}

function getProfileDirs(chromeHome: NuclideUri) {
  const profileDirs = [nuclideUri.join(chromeHome, 'Default')];

  let done;
  let profileNum = 1;
  while (!done) {
    try {
      const profilePath = nuclideUri.join(chromeHome, `Profile ${profileNum}`);
      fs.statSync(profilePath);
      profileDirs.push(profilePath);
      profileNum++;
    } catch (e) {
      done = true;
    }
  }

  return profileDirs;
}

function getVersionDirsForExtension(
  profileDirs: Array<NuclideUri>,
  extensionID: string,
): ?Array<NuclideUri> {
  for (const profileDir of profileDirs) {
    const extensionPath = nuclideUri.join(
      profileDir,
      'Extensions',
      extensionID,
    );
    try {
      return fs
        .readdirSync(extensionPath)
        .filter(base => !base.startsWith('.')) // Remove .DS_Store and others
        .map(base => nuclideUri.join(extensionPath, base));
    } catch (e) {}
  }
}
