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

import type {Device, DeviceType} from './types';

import {runCommand} from 'nuclide-commons/process';
import {Observable} from 'rxjs';
import {arrayEqual} from 'nuclide-commons/collection';
import shallowEqual from 'shallowequal';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getLogger} from 'log4js';

const poller = createPoller();

// Callback version
export function observeDevices(
  callback: (Array<Device> | Error) => void,
): IDisposable {
  const subscription = poller.subscribe(devices => callback(devices));
  return new UniversalDisposable(() => subscription.unsubscribe());
}

// Observable version
export function getDevices(): Observable<Array<Device> | Error> {
  return poller;
}

function createPoller(): Observable<Array<Device> | Error> {
  return Observable.interval(2000)
    .startWith(0)
    .switchMap(() => {
      return runCommand('fbsimctl', ['--json', '--format=%n%u%s%o%a', 'list'])
        .map(parseFbsimctlJsonOutput)
        .catch(error => {
          const friendlyError = new Error(
            "Can't fetch iOS devices. Make sure that fbsimctl is in your $PATH and that it works properly.",
          );
          if (error.code !== 'ENOENT') {
            getLogger().error(error);
          } else {
            // Keep the code so tooling higher up knows this is due to the tool missing.
            (friendlyError: any).code = 'ENOENT';
          }
          return Observable.of(friendlyError);
        });
    })
    .distinctUntilChanged((a, b) => {
      if (Array.isArray(a) && Array.isArray(b)) {
        return arrayEqual(a, b, shallowEqual);
      } else if (a instanceof Error && b instanceof Error) {
        return a.message === b.message;
      } else {
        return false;
      }
    })
    .catch(error => {
      getLogger().error(error);
      return Observable.of([]);
    })
    .publishReplay(1)
    .refCount();
}

function parseFbsimctlJsonOutput(output: string): Array<Device> {
  const devices = [];

  output.split('\n').forEach(line => {
    let event;
    try {
      event = JSON.parse(line);
    } catch (e) {
      return;
    }
    if (
      !event ||
      !event.event_name ||
      event.event_name !== 'list' ||
      !event.subject
    ) {
      return;
    }
    const device = event.subject;
    const {state, name, udid} = device;

    // TODO (#21958483): Remove this hack when `fbsimctl` produces the right
    // information for new OS devices.
    let {os, arch} = device;
    if (!os && !arch && /^(iPhone|iPad)/.test(name)) {
      os = 'iOS <unknown version>';
      arch = 'x86_64';
    }

    if (!state || !os || !name || !udid || !arch) {
      return;
    }

    if (!os.match(/^iOS (.+)$/)) {
      return;
    }
    const type = typeFromArch(arch);
    if (type == null) {
      return;
    }

    devices.push({
      name,
      udid,
      state,
      os,
      arch,
      type,
    });
  });

  return devices;
}

function typeFromArch(arch: string): ?DeviceType {
  switch (arch) {
    case 'x86_64':
    case 'i386':
      return 'simulator';
    case 'arm64':
    case 'armv7':
    case 'armv7s':
      return 'physical_device';
    default:
      return null;
  }
}
