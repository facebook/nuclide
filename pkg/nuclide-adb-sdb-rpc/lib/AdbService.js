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
  DeviceId,
  DeviceDescription,
  AndroidJavaProcess,
  Process,
  DebugBridgeFullConfig,
} from './types';

import {getStore} from './common/Store';
import {ConnectableObservable} from 'rxjs';
import {Adb} from './bridges/Adb';
import {Processes} from './common/Processes';
import {Devices} from './common/Devices';

const ADB = 'adb';

export async function registerAdbPath(
  id: string,
  path: NuclideUri,
  priority: number = -1,
): Promise<void> {
  getStore(ADB).registerPath(id, {path, priority});
}

export async function getFullConfig(): Promise<DebugBridgeFullConfig> {
  return getStore(ADB).getFullConfig();
}

export async function registerCustomPath(path: ?string): Promise<void> {
  getStore(ADB).registerCustomPath(path);
}

export function getDeviceInfo(
  device: DeviceId,
): ConnectableObservable<Map<string, string>> {
  return new Adb(device).getDeviceInfo().publish();
}

export function getProcesses(
  device: DeviceId,
): ConnectableObservable<Array<Process>> {
  return new Processes(new Adb(device)).fetch().publish();
}

export async function stopPackage(
  device: DeviceId,
  packageName: string,
): Promise<void> {
  return new Adb(device).stopPackage(packageName);
}

export function getDeviceList(): ConnectableObservable<
  Array<DeviceDescription>,
> {
  return new Devices(Adb).getDeviceList().publish();
}

export async function getPidFromPackageName(
  device: DeviceId,
  packageName: string,
): Promise<number> {
  return new Processes(new Adb(device)).getPidFromPackageName(packageName);
}

export function installPackage(
  device: DeviceId,
  packagePath: NuclideUri,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return new Adb(device).installPackage(packagePath).publish();
}

export function uninstallPackage(
  device: DeviceId,
  packageName: string,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return new Adb(device).uninstallPackage(packageName).publish();
}

export async function forwardJdwpPortToPid(
  device: DeviceId,
  tcpPort: number,
  pid: number,
): Promise<?string> {
  return new Adb(device).forwardJdwpPortToPid(tcpPort, pid);
}

export async function removeJdwpForwardSpec(
  device: DeviceId,
  spec: ?string,
): Promise<string> {
  return new Adb(device).removeJdwpForwardSpec(spec);
}

export async function launchActivity(
  device: DeviceId,
  packageName: string,
  activity: string,
  debug: boolean,
  action: ?string,
  parameters: ?Map<string, string>,
): Promise<string> {
  return new Adb(device).launchActivity(
    packageName,
    activity,
    debug,
    action,
    parameters,
  );
}

export async function launchMainActivity(
  device: DeviceId,
  packageName: string,
  debug: boolean,
  parameters: ?Map<string, string>,
): Promise<string> {
  return new Adb(device).launchMainActivity(packageName, debug, parameters);
}

export async function activityExists(
  device: DeviceId,
  packageName: string,
  activity: string,
): Promise<boolean> {
  return new Adb(device).activityExists(packageName, activity);
}

export function getJavaProcesses(
  device: DeviceId,
): ConnectableObservable<Array<AndroidJavaProcess>> {
  return new Adb(device).getJavaProcesses().publish();
}

export async function dumpsysPackage(
  device: DeviceId,
  identifier: string,
): Promise<?string> {
  return new Adb(device).dumpsysPackage(identifier);
}

export async function touchFile(
  device: DeviceId,
  path: string,
): Promise<string> {
  return new Adb(device).touchFile(path);
}

export async function removeFile(
  device: DeviceId,
  path: string,
): Promise<string> {
  return new Adb(device).removeFile(path);
}

export async function getInstalledPackages(
  device: DeviceId,
): Promise<Array<string>> {
  return new Adb(device).getInstalledPackages();
}

export function addAdbPort(port: number): void {
  getStore('adb').addPort(port);
}

export function removeAdbPort(port: number): void {
  getStore('adb').removePort(port);
}

export function getAdbPorts(): Promise<Array<number>> {
  return Promise.resolve(getStore('adb').getPorts());
}
