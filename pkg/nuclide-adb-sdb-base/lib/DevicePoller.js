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

import type {Expected} from '../../commons-node/expected';
import type {DeviceDescription} from '../../nuclide-adb-sdb-rpc/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Device} from '../../nuclide-device-panel/lib/types';

import {getAdbServiceByNuclideUri} from '../../nuclide-remote-connection';
import {getSdbServiceByNuclideUri} from '../../nuclide-remote-connection';
import {Observable} from 'rxjs';
import {Expect} from '../../commons-node/expected';
import {track} from '../../nuclide-analytics';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Cache} from '../../commons-node/cache';

export type DBType = 'sdb' | 'adb';

class DevicePoller {
  _type: DBType;
  _observables: Cache<string, Observable<Expected<Device[]>>> = new Cache();

  constructor(type: DBType) {
    this._type = type;
  }

  _getPlatform(): string {
    return this._type === 'adb' ? 'android' : 'tizen';
  }

  observe(_host: NuclideUri): Observable<Expected<Device[]>> {
    const host = nuclideUri.isRemote(_host) ? _host : '';
    return this._observables.getOrCreate(host, () =>
      Observable.interval(2000)
        .startWith(0)
        .switchMap(() =>
          this.fetch(host)
            .map(devices => Expect.value(devices))
            .catch(() =>
              Observable.of(
                Expect.error(
                  new Error(
                    `Can't fetch ${this._getPlatform()} devices. Make sure that ${this
                      ._type} is in your $PATH and that it works properly.`,
                  ),
                ),
              ),
            ),
        )
        .publishReplay(1)
        .refCount(),
    );
  }

  fetch(host: NuclideUri): Observable<Device[]> {
    try {
      const rpc =
        this._type === 'adb'
          ? getAdbServiceByNuclideUri(host)
          : getSdbServiceByNuclideUri(host);

      return rpc
        .getDeviceList()
        .refCount()
        .map(devices => devices.map(device => this.parseRawDevice(device)));
    } catch (e) {
      // The remote host connection can go away while we are fetching if the user
      // removes it from the file tree or the network connection is lost.
      return Observable.of([]);
    }
  }

  parseRawDevice(device: DeviceDescription): Device {
    let deviceArchitecture = '';
    for (const arch of ['arm64', 'arm', 'x86']) {
      if (device.architecture.startsWith(arch)) {
        deviceArchitecture = arch;
        break;
      }
    }
    let displayArch = deviceArchitecture;
    if (deviceArchitecture.length === 0) {
      track('nuclide-adb-sdb-base.unknown_device_arch', {deviceArchitecture});
      displayArch = device.architecture;
    }

    const displayName = (device.name.startsWith('emulator')
      ? device.name
      : device.model).concat(` (${displayArch}, API ${device.apiVersion})`);

    return {
      name: device.name,
      port: device.port,
      displayName,
      architecture: deviceArchitecture,
      rawArchitecture: device.architecture,
    };
  }
}

const pollers: Map<DBType, DevicePoller> = new Map();

function observeDevices(
  type: DBType,
  host: NuclideUri,
): Observable<Expected<Device[]>> {
  let poller = pollers.get(type);
  if (poller == null) {
    poller = new DevicePoller(type);
    pollers.set(type, poller);
  }
  return poller.observe(host);
}

export function observeAndroidDevices(host: NuclideUri): Observable<Device[]> {
  return observeDevices('adb', host).map(devices => devices.getOrDefault([]));
}

export function observeTizenDevices(host: NuclideUri): Observable<Device[]> {
  return observeDevices('sdb', host).map(devices => devices.getOrDefault([]));
}

export function observeAndroidDevicesX(
  host: NuclideUri,
): Observable<Expected<Device[]>> {
  return observeDevices('adb', host);
}

export function observeTizenDevicesX(
  host: NuclideUri,
): Observable<Expected<Device[]>> {
  return observeDevices('sdb', host);
}
