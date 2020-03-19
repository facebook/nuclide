/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  LegacyProcessMessage,
  ProcessMessage,
} from 'nuclide-commons/process';
import type {AdbDevice, AndroidJavaProcess, Process} from './types';

import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {ConnectableObservable} from 'rxjs';
import {Adb} from './Adb';
import {Processes} from './common/Processes';
import {runCommand} from 'nuclide-commons/process';
import {observeProcessRaw} from 'nuclide-commons/process';

export function getDeviceInfo(
  serial: string,
): ConnectableObservable<Map<string, string>> {
  return new Adb(serial).getDeviceInfo().publish();
}

export function getProcesses(
  serial: string,
  timeout: number,
): ConnectableObservable<Array<Process>> {
  return new Processes(new Adb(serial)).fetch(timeout).publish();
}

export async function stopProcess(
  serial: string,
  packageName: string,
  pid: number,
): Promise<void> {
  return new Adb(serial).stopProcess(packageName, pid);
}

export function trackDevices(): ConnectableObservable<Array<AdbDevice>> {
  return (
    observeProcessRaw('adb', ['track-devices'])
      .filter(
        event =>
          event.kind !== 'stderr' ||
          !event.data.startsWith('* daemon not running'),
      )
      .distinctUntilChanged()
      // track-devices doesn't provide the full output
      // we use its output as events to trigger an actual devices -l call
      .switchMap(() => getDeviceList())
      .publish()
  );
}

export function getDeviceList(): Promise<Array<AdbDevice>> {
  return Adb.getDevices();
}

export async function getPidFromPackageName(
  serial: string,
  packageName: string,
): Promise<number> {
  return new Processes(new Adb(serial)).getPidFromPackageName(packageName);
}

export function installPackage(
  serial: string,
  packagePath: NuclideUri,
): ConnectableObservable<ProcessMessage> {
  return new Adb(serial).installPackage(packagePath).publish();
}

export function uninstallPackage(
  serial: string,
  packageName: string,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return new Adb(serial).uninstallPackage(packageName).publish();
}

export async function forwardJdwpPortToPid(
  serial: string,
  tcpPort: number,
  pid: number,
): Promise<?string> {
  return new Adb(serial).forwardJdwpPortToPid(tcpPort, pid);
}

export async function removeJdwpForwardSpec(
  serial: string,
  spec: ?string,
): Promise<string> {
  return new Adb(serial).removeJdwpForwardSpec(spec);
}

export async function launchActivity(
  serial: string,
  packageName: string,
  activity: string,
  debug: boolean,
  action: ?string,
  parameters: ?Map<string, string>,
): Promise<string> {
  return new Adb(serial).launchActivity(
    packageName,
    activity,
    debug,
    action,
    parameters,
  );
}

export async function launchMainActivity(
  serial: string,
  packageName: string,
  debug: boolean,
): Promise<string> {
  return new Adb(serial).launchMainActivity(packageName, debug);
}

export async function launchService(
  serial: string,
  packageName: string,
  serviceName: string,
  debug: boolean,
): Promise<string> {
  return new Adb(serial).launchService(packageName, serviceName, debug);
}

export async function activityExists(
  serial: string,
  packageName: string,
  activity: string,
): Promise<boolean> {
  return new Adb(serial).activityExists(packageName, activity);
}

export async function getAllAvailablePackages(
  serial: string,
): Promise<Array<string>> {
  return new Adb(serial).getAllAvailablePackages();
}

export function getJavaProcesses(
  serial: string,
): ConnectableObservable<Array<AndroidJavaProcess>> {
  return new Adb(serial).getJavaProcesses().publish();
}

export async function dumpsysPackage(
  serial: string,
  identifier: string,
): Promise<?string> {
  return new Adb(serial).dumpsysPackage(identifier);
}

export async function touchFile(serial: string, path: string): Promise<string> {
  return new Adb(serial).touchFile(path);
}

export async function removeFile(
  serial: string,
  path: string,
): Promise<string> {
  return new Adb(serial).removeFile(path);
}

export async function getAPIVersion(serial: string): Promise<string> {
  return new Adb(serial).getAPIVersion().toPromise();
}

export async function getDeviceArchitecture(serial: string): Promise<string> {
  return new Adb(serial).getDeviceArchitecture().toPromise();
}

export async function getInstalledPackages(
  serial: string,
): Promise<Array<string>> {
  return new Adb(serial).getInstalledPackages();
}

export async function killServer(): Promise<void> {
  return Adb.killServer();
}

async function getAaptBinary(buildToolsVersion: ?string): Promise<string> {
  if (process.env.ANDROID_SDK == null || buildToolsVersion == null) {
    return 'aapt';
  } else {
    const allBuildToolsPath = nuclideUri.join(
      process.env.ANDROID_SDK,
      'build-tools',
    );
    const exactBuildToolPath = nuclideUri.join(
      allBuildToolsPath,
      buildToolsVersion,
    );
    const aaptPath = nuclideUri.join(exactBuildToolPath, 'aapt');
    if (await fsPromise.exists(aaptPath)) {
      return aaptPath;
    } else {
      return 'aapt';
    }
  }
}

export async function getApkManifest(
  apkPath: string,
  buildToolsVersion: ?string,
): Promise<string> {
  const aaptBinary = await getAaptBinary(buildToolsVersion);
  return runCommand(aaptBinary, ['dump', 'badging', apkPath]).toPromise();
}

export async function getVersion(): Promise<string> {
  return Adb.getVersion();
}

export async function checkMuxStatus(): Promise<boolean> {
  try {
    await runCommand('adbmux', ['status'])
      .ignoreElements()
      .toPromise();
  } catch (_) {
    return false;
  }
  return true;
}

export function checkInMuxPort(port: number): Promise<void> {
  return runCommand('adbmux', ['checkin', `${port}`])
    .ignoreElements()
    .toPromise();
}

export function checkOutMuxPort(port: number): Promise<void> {
  return runCommand('adbmux', ['checkout', `${port}`])
    .ignoreElements()
    .toPromise();
}
