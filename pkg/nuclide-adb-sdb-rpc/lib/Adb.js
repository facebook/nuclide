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

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {runCommand} from 'nuclide-commons/process';
import {AdbSdbBase} from './AdbSdbBase';
import {Observable} from 'rxjs';

import type {AndroidJavaProcess} from './types';
import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

export class Adb extends AdbSdbBase {
  getAndroidProp(device: string, key: string): Observable<string> {
    return this.runShortCommand(device, ['shell', 'getprop', key]).map(s =>
      s.trim(),
    );
  }

  getDeviceArchitecture(device: string): Observable<string> {
    return this.getAndroidProp(device, 'ro.product.cpu.abi');
  }

  async getInstalledPackages(device: string): Promise<Array<string>> {
    const prefix = 'package:';
    const stdout = await this.runShortCommand(device, [
      'shell',
      'pm',
      'list',
      'packages',
    ]).toPromise();
    return stdout.trim().split(/\s+/).map(s => s.substring(prefix.length));
  }

  async isPackageInstalled(device: string, pkg: string): Promise<boolean> {
    const packages = await this.getInstalledPackages(device);
    return packages.includes(pkg);
  }

  getDeviceModel(device: string): Observable<string> {
    return this.getAndroidProp(device, 'ro.product.model').map(
      s => (s === 'sdk' ? 'emulator' : s),
    );
  }

  getAPIVersion(device: string): Observable<string> {
    return this.getAndroidProp(device, 'ro.build.version.sdk');
  }

  getBrand(device: string): Observable<string> {
    return this.getAndroidProp(device, 'ro.product.brand');
  }

  getManufacturer(device: string): Observable<string> {
    return this.getAndroidProp(device, 'ro.product.manufacturer');
  }

  getDeviceInfo(device: string): Observable<Map<string, string>> {
    return this.getCommonDeviceInfo(device).switchMap(infoTable => {
      const unknownCB = () => Observable.of('');
      return Observable.forkJoin(
        this.getOSVersion(device).catch(unknownCB),
        this.getManufacturer(device).catch(unknownCB),
        this.getBrand(device).catch(unknownCB),
        this.getWifiIp(device).catch(unknownCB),
      ).map(([android_version, manufacturer, brand, wifi_ip]) => {
        infoTable.set('android_version', android_version);
        infoTable.set('manufacturer', manufacturer);
        infoTable.set('brand', brand);
        infoTable.set('wifi_ip', wifi_ip);
        return infoTable;
      });
    });
  }

  getWifiIp(device: string): Observable<string> {
    return this.runShortCommand(device, [
      'shell',
      'ip',
      'addr',
      'show',
      'wlan0',
    ]).map(lines => {
      const line = lines.split(/\n/).filter(l => l.includes('inet'))[0];
      if (line == null) {
        return '';
      }
      const rawIp = line.trim().split(/\s+/)[1];
      return rawIp.substring(0, rawIp.indexOf('/'));
    });
  }

  // Can't use kill, the only option is to use the package name
  // http://stackoverflow.com/questions/17154961/adb-shell-operation-not-permitted
  async stopPackage(device: string, packageName: string): Promise<void> {
    await this.runShortCommand(device, [
      'shell',
      'am',
      'force-stop',
      packageName,
    ]).toPromise();
  }

  getOSVersion(device: string): Observable<string> {
    return this.getAndroidProp(device, 'ro.build.version.release');
  }

  installPackage(
    device: string,
    packagePath: NuclideUri,
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    invariant(!nuclideUri.isRemote(packagePath));
    return this.runLongCommand(device, ['install', '-r', packagePath]);
  }

  uninstallPackage(
    device: string,
    packageName: string,
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return this.runLongCommand(device, ['uninstall', packageName]);
  }

  forwardJdwpPortToPid(
    device: string,
    tcpPort: number,
    pid: number,
  ): Promise<string> {
    return this.runShortCommand(device, [
      'forward',
      `tcp:${tcpPort}`,
      `jdwp:${pid}`,
    ]).toPromise();
  }

  launchActivity(
    device: string,
    packageName: string,
    activity: string,
    debug: boolean,
    action: ?string,
  ): Promise<string> {
    const args = ['shell', 'am', 'start', '-W', '-n'];
    if (action != null) {
      args.push('-a', action);
    }
    if (debug) {
      args.push('-N', '-D');
    }
    args.push(`${packageName}/${activity}`);
    return this.runShortCommand(device, args).toPromise();
  }

  activityExists(
    device: string,
    packageName: string,
    activity: string,
  ): Promise<boolean> {
    const packageActivityString = `${packageName}/${activity}`;
    const deviceArg = device !== '' ? ['-s', device] : [];
    const command = deviceArg.concat(['shell', 'dumpsys', 'package']);
    return runCommand(this._dbPath, command)
      .map(stdout => stdout.includes(packageActivityString))
      .toPromise();
  }

  touchFile(device: string, path: string): Promise<string> {
    const deviceArg = device !== '' ? ['-s', device] : [];
    const command = deviceArg.concat(['shell', 'touch', path]);
    return runCommand(this._dbPath, command).toPromise();
  }

  removeFile(device: string, path: string): Promise<string> {
    const deviceArg = device !== '' ? ['-s', device] : [];
    const command = deviceArg.concat(['shell', 'rm', path]);
    return runCommand(this._dbPath, command).toPromise();
  }

  getJavaProcesses(device: string): Observable<Array<AndroidJavaProcess>> {
    return this.runShortCommand(device, ['shell', 'ps'])
      .map(stdout => {
        const psOutput = stdout.trim();
        return parsePsTableOutput(psOutput, ['user', 'pid', 'name']);
      })
      .switchMap(allProcesses => {
        return this.runLongCommand(device, ['jdwp'])
          .catch(error => Observable.of({kind: 'error', error})) // TODO(T17463635)
          .take(1)
          .timeout(1000)
          .map(output => {
            const jdwpPids = new Set();
            if (output.kind === 'stdout') {
              const block: string = output.data;
              block.split(/\s+/).forEach(pid => {
                jdwpPids.add(pid.trim());
              });
            }
            return allProcesses.filter(row => jdwpPids.has(row.pid));
          });
      });
  }

  async dumpsysPackage(device: string, pkg: string): Promise<?string> {
    if (!await this.isPackageInstalled(device, pkg)) {
      return null;
    }
    return this.runShortCommand(device, [
      'shell',
      'dumpsys',
      'package',
      pkg,
    ]).toPromise();
  }
}

export function parsePsTableOutput(
  output: string,
  desiredFields: Array<string>,
): Array<Object> {
  const lines = output.split(/\n/);
  const header = lines[0];
  const cols = header.split(/\s+/);
  const colMapping = {};

  for (let i = 0; i < cols.length; i++) {
    const columnName = cols[i].toLowerCase();
    if (desiredFields.includes(columnName)) {
      colMapping[i] = columnName;
    }
  }

  const formattedData = [];
  const data = lines.slice(1);
  data.filter(row => row.trim() !== '').forEach(row => {
    const rowData = row.split(/\s+/);
    const rowObj = {};
    for (let i = 0; i < rowData.length; i++) {
      // Android's ps output has an extra column "S" in the data that doesn't appear
      // in the header. Skip that column's value.
      const effectiveColumn = i;
      if (rowData[i] === 'S' && i < rowData.length - 1) {
        i++;
      }

      if (colMapping[effectiveColumn] !== undefined) {
        rowObj[colMapping[effectiveColumn]] = rowData[i];
      }
    }

    formattedData.push(rowObj);
  });

  return formattedData;
}
