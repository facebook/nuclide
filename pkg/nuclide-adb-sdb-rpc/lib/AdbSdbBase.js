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

import {observeProcess, runCommand} from 'nuclide-commons/process';
import os from 'os';
import {Observable} from 'rxjs';

import type {DeviceDescription} from './types';
import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

export class AdbSdbBase {
  _dbPath: string;

  constructor(dbPath: string) {
    this._dbPath = dbPath;
  }

  runShortCommand(device: string, command: Array<string>): Observable<string> {
    const deviceArg = device !== '' ? ['-s', device] : [];
    return runCommand(this._dbPath, deviceArg.concat(command));
  }

  runLongCommand(
    device: string,
    command: string[],
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    const deviceArg = device !== '' ? ['-s', device] : [];
    return observeProcess(this._dbPath, deviceArg.concat(command), {
      killTreeWhenDone: true,
      /* TODO(T17353599) */ isExitError: () => false,
    }).catch(error => Observable.of({kind: 'error', error})); // TODO(T17463635)
  }

  getCommonDeviceInfo(device: string): Observable<Map<string, string>> {
    const unknownCB = () => Observable.of('');
    return Observable.forkJoin(
      this.getDeviceArchitecture(device).catch(unknownCB),
      this.getAPIVersion(device).catch(unknownCB),
      this.getDeviceModel(device).catch(unknownCB),
    ).map(([architecture, apiVersion, model]) => {
      return new Map([
        ['name', device],
        ['architecture', architecture],
        ['api_version', apiVersion],
        ['model', model],
      ]);
    });
  }

  getDeviceList(): Observable<Array<DeviceDescription>> {
    return runCommand(this._dbPath, ['devices'])
      .map(stdout =>
        stdout
          .split(/\n+/g)
          .slice(1)
          .filter(s => s.length > 0 && !s.trim().startsWith('*'))
          .map(s => s.split(/\s+/g))
          .filter(a => a[0] !== '')
          .map(a => a[0]),
      )
      .switchMap(devices => {
        return Observable.concat(
          ...devices.map(name => {
            return Observable.forkJoin(
              this.getDeviceArchitecture(name).catch(() => Observable.of('')),
              this.getAPIVersion(name).catch(() => Observable.of('')),
              this.getDeviceModel(name).catch(() => Observable.of('')),
            ).map(([architecture, apiVersion, model]) => ({
              name,
              architecture,
              apiVersion,
              model,
            }));
          }),
        ).toArray();
      });
  }

  async getFileContentsAtPath(device: string, path: string): Promise<string> {
    return this.runShortCommand(device, ['shell', 'cat', path]).toPromise();
  }

  getDeviceArchitecture(device: string): Observable<string> {
    return Observable.of('');
  }

  getDeviceModel(device: string): Observable<string> {
    return Observable.of('');
  }

  getAPIVersion(device: string): Observable<string> {
    return Observable.of('');
  }

  installPackage(
    device: string,
    packagePath: NuclideUri,
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    throw new Error('not implemented');
  }

  uninstallPackage(
    device: string,
    packageName: string,
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    throw new Error('not implemented');
  }

  async getPidFromPackageName(
    device: string,
    packageName: string,
  ): Promise<number> {
    const pidLine = (await this.runShortCommand(device, [
      'shell',
      'ps',
      '|',
      'grep',
      '-i',
      packageName,
    ]).toPromise()).split(os.EOL)[0];
    if (pidLine == null) {
      throw new Error(
        `Can not find a running process with package name: ${packageName}`,
      );
    }
    // First column is 'USER', second is 'PID'.
    return parseInt(pidLine.trim().split(/\s+/)[1], /* radix */ 10);
  }
}
