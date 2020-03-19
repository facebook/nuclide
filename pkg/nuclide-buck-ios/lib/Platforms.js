/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {DeviceGroup, Platform} from '../../nuclide-buck/lib/types';
import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {BuckEvent} from '../../nuclide-buck/lib/BuckEventStream';
import type {FbsimctlDevice} from '../../nuclide-fbsimctl-rpc/lib/types';

import nullthrows from 'nullthrows';
import {getTasks, runTask} from './Tasks';

import {Observable} from 'rxjs';
import * as fbsimctl from '../../nuclide-fbsimctl';

export function getSimulatorPlatform(
  buckRoot: NuclideUri,
  ruleType: string,
  debuggerCallback: ?(
    Observable<LegacyProcessMessage>,
  ) => Observable<BuckEvent>,
): Observable<Platform> {
  return fbsimctl
    .observeIosDevices('')
    .filter(expected => !expected.isPending)
    .map(expected => {
      // TODO: Come up with a way to surface the error in UI
      const simulators = expected
        .getOrDefault([])
        .filter(device => device.type === 'simulator');

      let deviceGroups;
      let devicesForIdentifiers;
      if (simulators.length === 0) {
        // No simulators installed, at least give user a chance to build.
        deviceGroups = [BUILD_ONLY_SIMULATORS.deviceGroup];
        devicesForIdentifiers = BUILD_ONLY_SIMULATORS.devicesForIdentifiers;
      } else {
        deviceGroups = groupByOs(simulators);
        devicesForIdentifiers = new Map(simulators.map(s => [s.udid, s]));
      }

      return {
        isMobile: true,
        name: 'Simulator',
        tasksForDevice: device =>
          getTasks(
            buckRoot,
            ruleType,
            BUILD_ONLY_SIMULATORS.devicesForIdentifiers.has(
              nullthrows(device).identifier,
            ),
            debuggerCallback != null,
          ),
        runTask: (builder, taskType, target, settings, device) =>
          runTask(
            builder,
            taskType,
            ruleType,
            target,
            settings,
            nullthrows(
              devicesForIdentifiers.get(nullthrows(device).identifier),
            ),
            buckRoot,
            debuggerCallback,
          ),
        deviceGroups,
      };
    });
}

export function getDevicePlatform(
  buckRoot: NuclideUri,
  ruleType: string,
  debuggerCallback: ?(
    Observable<LegacyProcessMessage>,
  ) => Observable<BuckEvent>,
): Observable<Platform> {
  return fbsimctl
    .observeIosDevices('')
    .filter(expected => !expected.isPending)
    .map(expected => {
      let deviceGroups = [];
      const devices = expected.getOrDefault([]);
      const physicalDevices = devices.filter(
        device => device.type === 'physical_device',
      );

      const devicesForIdentifiers = new Map();

      if (physicalDevices.length > 0) {
        physicalDevices.forEach(d => {
          devicesForIdentifiers.set(d.udid, d);
        });
        deviceGroups = groupByOs(physicalDevices);
      }

      // Always give user a chance to build for all architectures.
      deviceGroups.push(BUILD_ONLY_DEVICES.deviceGroup);
      BUILD_ONLY_DEVICES.devicesForIdentifiers.forEach(d => {
        devicesForIdentifiers.set(d.udid, d);
      });

      return {
        isMobile: true,
        name: 'Device',
        tasksForDevice: device =>
          getTasks(
            buckRoot,
            ruleType,
            BUILD_ONLY_DEVICES.devicesForIdentifiers.has(
              nullthrows(device).identifier,
            ),
            debuggerCallback != null,
          ),
        runTask: (builder, taskType, target, settings, device) => {
          return runTask(
            builder,
            taskType,
            ruleType,
            target,
            settings,
            nullthrows(
              devicesForIdentifiers.get(nullthrows(device).identifier),
            ),
            buckRoot,
            debuggerCallback,
          );
        },
        deviceGroups,
      };
    });
}

function groupByOs(devices: Array<FbsimctlDevice>): Array<DeviceGroup> {
  const devicesByOs = devices.reduce((memo, device) => {
    let devicesForOs = memo.get(device.os);
    if (devicesForOs == null) {
      devicesForOs = [];
      memo.set(device.os, devicesForOs);
    }
    devicesForOs.push({identifier: device.udid, name: device.name});
    return memo;
  }, new Map());

  for (const devicesForOs of devicesByOs.values()) {
    devicesForOs.sort((a, b) => {
      return b.name.localeCompare(a.name);
    });
  }

  return Array.from(devicesByOs.entries()).map(([os, devicesForOs]) => ({
    name: os,
    devices: devicesForOs,
  }));
}

const BUILD_ONLY_SIMULATORS: {
  deviceGroup: DeviceGroup,
  devicesForIdentifiers: Map<string, FbsimctlDevice>,
} = {
  deviceGroup: {
    name: 'Generic',
    devices: [
      {
        identifier: 'build-only-x86_64',
        name: '64-bit',
      },
      {
        identifier: 'build-only-i386',
        name: '32-bit',
      },
    ],
  },
  devicesForIdentifiers: new Map([
    [
      'build-only-x86_64',
      {
        name: '64-bit',
        udid: 'build-only-x86_64',
        arch: 'x86_64',
        type: 'simulator',
        os: '',
        state: 'Booted',
      },
    ],
    [
      'build-only-i386',
      {
        name: '32-bit',
        udid: 'build-only-i386',
        arch: 'i386',
        type: 'simulator',
        os: '',
        state: 'Booted',
      },
    ],
  ]),
};

const BUILD_ONLY_DEVICES: {
  deviceGroup: DeviceGroup,
  devicesForIdentifiers: Map<string, FbsimctlDevice>,
} = {
  deviceGroup: {
    name: 'Generic',
    devices: [
      {
        identifier: 'build-only-arm64',
        name: '64-bit',
      },
      {
        identifier: 'build-only-armv7',
        name: '32-bit',
      },
    ],
  },
  devicesForIdentifiers: new Map([
    [
      'build-only-arm64',
      {
        name: '64-bit',
        udid: 'build-only-arm64',
        arch: 'arm64',
        type: 'physical_device',
        os: '',
        state: 'Booted',
      },
    ],
    [
      'build-only-armv7',
      {
        name: '32-bit',
        udid: 'build-only-armv7',
        arch: 'armv7',
        type: 'physical_device',
        os: '',
        state: 'Booted',
      },
    ],
  ]),
};
