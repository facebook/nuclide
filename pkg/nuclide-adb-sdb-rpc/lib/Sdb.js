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

import {AdbSdbBase} from './AdbSdbBase';
import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';

import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

export class Sdb extends AdbSdbBase {
  getTizenModelConfigKey(device: string, key: string): Observable<string> {
    const modelConfigPath = '/etc/config/model-config.xml';

    return this.runShortCommand(device, ['shell', 'cat', modelConfigPath])
      .map(stdout => stdout.split(/\n+/g).filter(s => s.indexOf(key) !== -1)[0])
      .map(s => {
        const regex = /.*<.*>(.*)<.*>/g;
        return regex.exec(s)[1];
      });
  }

  getDeviceArchitecture(device: string): Observable<string> {
    return this.runShortCommand(device, ['shell', 'uname', '-m']).map(s =>
      s.trim(),
    );
  }

  getDeviceModel(device: string): Observable<string> {
    return this.getTizenModelConfigKey(device, 'tizen.org/system/model_name');
  }

  getAPIVersion(device: string): Observable<string> {
    return this.getTizenModelConfigKey(
      device,
      'tizen.org/feature/platform.core.api.version',
    ).catch(() =>
      this.getTizenModelConfigKey(
        device,
        'tizen.org/feature/platform.native.api.version',
      ),
    );
  }

  installPackage(
    device: string,
    packagePath: NuclideUri,
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    invariant(!nuclideUri.isRemote(packagePath));
    return this.runLongCommand(device, ['install', packagePath]);
  }

  launchApp(device: string, identifier: string): Promise<string> {
    return this.runShortCommand(device, [
      'shell',
      'launch_app',
      identifier,
    ]).toPromise();
  }

  uninstallPackage(
    device: string,
    packageName: string,
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return this.runLongCommand(device, ['uninstall', packageName]);
  }
}
