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

import {pathForDebugBridge, getStore} from './AdbSdbPathStore';
import {ConnectableObservable, Observable} from 'rxjs';
import {Sdb} from './Sdb';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {DeviceDescription, DBPathsInfo} from './types';

export async function registerSdbPath(
  id: string,
  path: NuclideUri,
  priority: number = -1,
): Promise<void> {
  getStore('sdb').registerPath(id, {path, priority});
}

export async function getCurrentPathsInfo(): Promise<DBPathsInfo> {
  return getStore('sdb').getCurrentPathsInfo();
}

export async function registerCustomPath(path: ?string): Promise<void> {
  getStore('adb').registerCustomPath(path);
}

async function getSdb(): Promise<Sdb> {
  return new Sdb((await pathForDebugBridge('sdb')));
}

const sdbObs = Observable.defer(() =>
  pathForDebugBridge('sdb'),
).switchMap(sdbPath => Observable.of(new Sdb(sdbPath)));

export function getDeviceInfo(
  name: string,
): ConnectableObservable<Map<string, string>> {
  return sdbObs.switchMap(sdb => sdb.getCommonDeviceInfo(name)).publish();
}

export function getDeviceList(): ConnectableObservable<
  Array<DeviceDescription>,
> {
  return sdbObs.switchMap(sdb => sdb.getDeviceList()).publish();
}

export async function getPidFromPackageName(
  device: string,
  packageName: string,
): Promise<number> {
  return (await getSdb()).getPidFromPackageName(device, packageName);
}

export async function getFileContentsAtPath(
  device: string,
  path: string,
): Promise<string> {
  return (await getSdb()).getFileContentsAtPath(device, path);
}

export function installPackage(
  device: string,
  packagePath: NuclideUri,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return Observable.defer(() => getSdb())
    .switchMap(d => d.installPackage(device, packagePath))
    .publish();
}

export async function launchApp(
  device: string,
  identifier: string,
): Promise<string> {
  return (await getSdb()).launchApp(device, identifier);
}

export function uninstallPackage(
  device: string,
  packageName: string,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return Observable.defer(() => getSdb())
    .switchMap(d => d.uninstallPackage(device, packageName))
    .publish();
}
