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
import type {DebugBridgeConfig, DeviceId} from '../types';

import {Observable} from 'rxjs';
import {observeProcess, runCommand} from 'nuclide-commons/process';

export const DEFAULT_ADB_PORT = 5037;

function getPortArg(port: ?number): Array<string> {
  return port != null ? ['-P', String(port)] : [];
}

export class DebugBridge {
  static configObs: Observable<DebugBridgeConfig>;

  _device: DeviceId;

  constructor(device: DeviceId) {
    this._device = device;
  }

  runShortCommand(...command: string[]): Observable<string> {
    return this.constructor.configObs.switchMap(config =>
      runCommand(
        config.path,
        this._getDeviceArg().concat(this._getPortArg()).concat(command),
      ),
    );
  }

  runLongCommand(...command: string[]): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return this.constructor.configObs.switchMap(config =>
      observeProcess(
        config.path,
        this._getDeviceArg().concat(this._getPortArg()).concat(command),
        {
          killTreeWhenDone: true,
          /* TODO(T17353599) */ isExitError: () => false,
        },
      ).catch(error => Observable.of({kind: 'error', error})),
    ); // TODO(T17463635)
  }

  _getPortArg(): Array<string> {
    return getPortArg(this._device.port);
  }

  _getDeviceArg(): Array<string> {
    return this._device.name !== '' ? ['-s', this._device.name] : [];
  }

  static getDevices(): Observable<Array<DeviceId>> {
    return this.configObs.switchMap(config => {
      return Observable.concat(
        ...config.ports.map(port =>
          runCommand(
            config.path,
            getPortArg(port).concat(['devices']),
          ).map(stdout =>
            stdout
              .split(/\n+/g)
              .slice(1)
              .filter(s => s.length > 0 && !s.trim().startsWith('*'))
              .map(s => s.split(/\s+/g))
              .filter(a => a[0] !== '')
              .map(a => ({
                name: a[0],
                port,
              })),
          ),
        ),
      )
        .toArray()
        .switchMap(deviceList =>
          Observable.of(
            deviceList.reduce((a, b) => (a != null ? a.concat(...b) : b)),
          ),
        );
    });
  }
}
