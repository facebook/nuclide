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

import type {DeviceDescription} from '../types';

import {Adb} from '../bridges/Adb';
import {Sdb} from '../bridges/Sdb';
import {Observable} from 'rxjs';

type Db = Class<Adb> | Class<Sdb>;

export class Devices {
  _db: Db;

  constructor(db: Db) {
    this._db = db;
  }

  getDeviceList(): Observable<Array<DeviceDescription>> {
    return this._db.getDevices().switchMap(devices => {
      return Observable.concat(
        ...devices.map(deviceId => {
          const db = new this._db(deviceId);
          return Observable.forkJoin(
            db.getDeviceArchitecture().catch(() => Observable.of('')),
            db.getAPIVersion().catch(() => Observable.of('')),
            db.getDeviceModel().catch(() => Observable.of('')),
          ).map(([architecture, apiVersion, model]) => ({
            name: deviceId.name,
            port: deviceId.port,
            architecture,
            apiVersion,
            model,
          }));
        }),
      ).toArray();
    });
  }
}
