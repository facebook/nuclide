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
import type {FbsimctlDevice} from './types';

import {runCommand} from 'nuclide-commons/process';
import fetch from '../../commons-node/xfetch';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import AdmZip from 'adm-zip';
import bplist from 'bplist-parser';
import {parseFbsimctlJsonOutput} from './Parsing';

export async function getDevices(): Promise<Array<FbsimctlDevice>> {
  const output = await runCommand('fbsimctl', [
    '--json',
    '--format=%n%u%s%o%a',
    'list',
  ])
    .catch(e => {
      if (e.stdout != null) {
        e.message += `\n\n${e.stdout}`;
      }
      throw e;
    })
    .timeout(5000)
    .toPromise();
  return parseFbsimctlJsonOutput(output);
}

export async function install(port: string, ipaUri: NuclideUri): Promise<void> {
  const file = await fsPromise.readFile(nuclideUri.getPath(ipaUri));
  await fetch(`${_getHostname(port)}/install?codesign=1`, {
    method: 'POST',
    body: file,
  });
}

export async function relaunch(port: string, bundleId: string): Promise<void> {
  await fetch(`${_getHostname(port)}/relaunch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      bundle_id: bundleId,
    }),
  });
}

export async function getBundleIdOfBundleAtPath(
  bundlePath: NuclideUri,
): Promise<string> {
  let plistData = null;

  const stat = await fsPromise.stat(nuclideUri.getPath(bundlePath));
  if (stat.isFile()) {
    const bundle = await fsPromise.readFile(nuclideUri.getPath(bundlePath));
    const infoPlist = new AdmZip(bundle)
      .getEntries()
      .find(entry => entry.entryName.match(/.app\/Info.plist$/));

    if (!infoPlist) {
      throw new Error("App bundle doesn't contain Info.plist");
    }
    plistData = infoPlist.getData();
  } else {
    plistData = await fsPromise.readFile(
      nuclideUri.getPath(nuclideUri.join(bundlePath, 'Info.plist')),
    );
  }

  let CFBundleIdentifier;
  bplist.parseFile(plistData, (error, parsed) => {
    if (parsed && parsed.length > 0) {
      CFBundleIdentifier = parsed[0].CFBundleIdentifier;
    }
  });

  if (!CFBundleIdentifier) {
    throw new Error("Couldn't find bundle identifier in bundle's Info.plist");
  }
  return CFBundleIdentifier;
}

function _getHostname(port: string): string {
  return `http://localhost:${port}`;
}
