'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {ConnectableObservable} from 'rxjs';
import type {DeviceDescription} from './AdbService';
import type {NuclideUri} from '../../commons-node/nuclideUri';
import {runCommand} from '../../commons-node/process';

export function startServer(
  adbPath: NuclideUri,
): ConnectableObservable<string> {
  return runCommand(adbPath, ['start-server']).publish();
}

export async function getDeviceList(
  adbPath: NuclideUri,
): Promise<Array<DeviceDescription>> {
  const devices = await runCommand(adbPath, ['devices'])
    .map(stdout => stdout.split(/\n+/g)
                     .slice(1)
                     .filter(s => s.length > 0)
                     .map(s => s.split(/\s+/g)[0])).toPromise();

  return Promise.all(devices.map(async s => {
    const arch = await getDeviceArchitecture(adbPath, s);
    return {name: s, architecture: arch};
  }));
}

export function getDeviceArchitecture(
  adbPath: NuclideUri,
  device: string,
): Promise<string> {
  return runCommand(
    adbPath,
    ['-s', device, 'shell', 'getprop', 'ro.product.cpu.abi'],
  ).map(s => s.trim())
  .toPromise();
}
