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
import type {
  DeviceDescription,
  AndroidJavaProcess,
  Process,
  DBPathsInfo,
} from './types';

import {pathForDebugBridge, getStore} from './AdbSdbPathStore';
import {ConnectableObservable, Observable} from 'rxjs';
import {Adb} from './Adb';
import {AdbTop} from './AdbTop';

async function getAdb(): Promise<Adb> {
  return new Adb((await pathForDebugBridge('adb')));
}

const adbObs = Observable.defer(() =>
  pathForDebugBridge('adb'),
).switchMap(adbPath => Observable.of(new Adb(adbPath)));

export async function registerAdbPath(
  id: string,
  path: NuclideUri,
  priority: number = -1,
): Promise<void> {
  getStore('adb').registerPath(id, {path, priority});
}

export async function getCurrentPathsInfo(): Promise<DBPathsInfo> {
  return getStore('adb').getCurrentPathsInfo();
}

export async function registerCustomPath(path: ?string): Promise<void> {
  getStore('adb').registerCustomPath(path);
}

export function getDeviceInfo(
  device: string,
): ConnectableObservable<Map<string, string>> {
  return adbObs.switchMap(adb => adb.getDeviceInfo(device)).publish();
}

export function getProcesses(
  device: string,
): ConnectableObservable<Array<Process>> {
  return adbObs
    .switchMap(adb => {
      return new AdbTop(adb, device).fetch();
    })
    .publish();
}

export async function stopPackage(
  device: string,
  packageName: string,
): Promise<void> {
  return (await getAdb()).stopPackage(device, packageName);
}

export function getDeviceList(): ConnectableObservable<
  Array<DeviceDescription>,
> {
  return adbObs.switchMap(adb => adb.getDeviceList()).publish();
}

export async function getPidFromPackageName(
  device: string,
  packageName: string,
): Promise<number> {
  return (await getAdb()).getPidFromPackageName(device, packageName);
}

export function installPackage(
  device: string,
  packagePath: NuclideUri,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return adbObs.switchMap(d => d.installPackage(device, packagePath)).publish();
}

export function uninstallPackage(
  device: string,
  packageName: string,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return adbObs
    .switchMap(d => d.uninstallPackage(device, packageName))
    .publish();
}

export async function forwardJdwpPortToPid(
  device: string,
  tcpPort: number,
  pid: number,
): Promise<string> {
  return (await getAdb()).forwardJdwpPortToPid(device, tcpPort, pid);
}

export async function launchActivity(
  device: string,
  packageName: string,
  activity: string,
  debug: boolean,
  action: ?string,
): Promise<string> {
  return (await getAdb()).launchActivity(
    device,
    packageName,
    activity,
    debug,
    action,
  );
}

export async function activityExists(
  device: string,
  packageName: string,
  activity: string,
): Promise<boolean> {
  return (await getAdb()).activityExists(device, packageName, activity);
}

export function getJavaProcesses(
  device: string,
): ConnectableObservable<Array<AndroidJavaProcess>> {
  return adbObs.switchMap(adb => adb.getJavaProcesses(device)).publish();
}

export async function dumpsysPackage(
  device: string,
  identifier: string,
): Promise<?string> {
  return (await getAdb()).dumpsysPackage(device, identifier);
}

export async function touchFile(device: string, path: string): Promise<string> {
  return (await getAdb()).touchFile(device, path);
}

export async function removeFile(
  device: string,
  path: string,
): Promise<string> {
  return (await getAdb()).removeFile(device, path);
}

export async function getInstalledPackages(
  device: string,
): Promise<Array<string>> {
  return (await getAdb()).getInstalledPackages(device);
}
