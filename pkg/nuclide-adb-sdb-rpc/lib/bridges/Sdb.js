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

import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {SimpleProcess} from '../types';

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';
import {DebugBridge} from '../common/DebugBridge';
import {createConfigObs} from '../common/Store';

export class Sdb extends DebugBridge {
  static configObs = createConfigObs('sdb');

  async getFileContentsAtPath(path: string): Promise<string> {
    return this.runShortCommand('shell', 'cat', path).toPromise();
  }

  getDeviceInfo(): Observable<Map<string, string>> {
    const unknownCB = () => Observable.of('');
    return Observable.forkJoin(
      this.getDeviceArchitecture().catch(unknownCB),
      this.getAPIVersion().catch(unknownCB),
      this.getDeviceModel().catch(unknownCB),
    ).map(([architecture, apiVersion, model]) => {
      return new Map([
        ['name', this._device.name],
        ['sdb_port', String(this._device.port)],
        ['architecture', architecture],
        ['api_version', apiVersion],
        ['model', model],
      ]);
    });
  }

  getTizenModelConfigKey(key: string): Observable<string> {
    const modelConfigPath = '/etc/config/model-config.xml';

    return this.runShortCommand('shell', 'cat', modelConfigPath)
      .map(stdout => stdout.split(/\n+/g).filter(s => s.indexOf(key) !== -1)[0])
      .map(s => {
        const regex = /.*<.*>(.*)<.*>/g;
        return regex.exec(s)[1];
      });
  }

  getDeviceArchitecture(): Observable<string> {
    return this.runShortCommand('shell', 'uname', '-m').map(s => s.trim());
  }

  getDeviceModel(): Observable<string> {
    return this.getTizenModelConfigKey('tizen.org/system/model_name');
  }

  getDebuggableProcesses(): Observable<Array<SimpleProcess>> {
    throw new Error('not implemented');
  }

  getAPIVersion(): Observable<string> {
    return this.getTizenModelConfigKey(
      'tizen.org/feature/platform.core.api.version',
    ).catch(() =>
      this.getTizenModelConfigKey(
        'tizen.org/feature/platform.native.api.version',
      ),
    );
  }

  installPackage(packagePath: NuclideUri): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    invariant(!nuclideUri.isRemote(packagePath));
    return this.runLongCommand('install', packagePath);
  }

  launchApp(identifier: string): Promise<string> {
    return this.runShortCommand('shell', 'launch_app', identifier).toPromise();
  }

  uninstallPackage(packageName: string): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return this.runLongCommand('uninstall', packageName);
  }
}
