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
import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {DeviceDescription, DebugBridgeFullConfig, DeviceId} from './types';

import {getStore} from './common/Store';
import {ConnectableObservable} from 'rxjs';
import {Sdb} from './bridges/Sdb';
import {Processes} from './common/Processes';
import {Devices} from './common/Devices';

const SDB = 'sdb';

export async function registerSdbPath(
  id: string,
  path: NuclideUri,
  priority: number = -1,
): Promise<void> {
  getStore(SDB).registerPath(id, {path, priority});
}

export async function getFullConfig(): Promise<DebugBridgeFullConfig> {
  return getStore(SDB).getFullConfig();
}

export async function registerCustomPath(path: ?string): Promise<void> {
  getStore(SDB).registerCustomPath(path);
}

export function getDeviceInfo(
  device: DeviceId,
): ConnectableObservable<Map<string, string>> {
  return new Sdb(device).getDeviceInfo().publish();
}

export function getDeviceList(): ConnectableObservable<
  Array<DeviceDescription>,
> {
  return new Devices(Sdb).getDeviceList().publish();
}

export async function getPidFromPackageName(
  device: DeviceId,
  packageName: string,
): Promise<number> {
  return new Processes(new Sdb(device)).getPidFromPackageName(packageName);
}

export async function getFileContentsAtPath(
  device: DeviceId,
  path: string,
): Promise<string> {
  return new Sdb(device).getFileContentsAtPath(path);
}

export function installPackage(
  device: DeviceId,
  packagePath: NuclideUri,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return new Sdb(device).installPackage(packagePath).publish();
}

export async function launchApp(
  device: DeviceId,
  identifier: string,
): Promise<string> {
  return new Sdb(device).launchApp(identifier);
}

export function uninstallPackage(
  device: DeviceId,
  packageName: string,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return new Sdb(device).uninstallPackage(packageName).publish();
}
