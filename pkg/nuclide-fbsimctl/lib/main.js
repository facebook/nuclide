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

import {runCommand} from 'nuclide-commons/process';
import memoize from 'lodash.memoize';
import {Observable} from 'rxjs';

export type SimulatorState =
  | 'CREATING'
  | 'BOOTING'
  | 'SHUTTING_DOWN'
  | 'SHUT_DOWN'
  | 'BOOTED';

export type Simulator = {
  name: string,
  udid: string,
  state: ?SimulatorState,
  os: string,
  arch: string,
};

export type Device = {
  name: string,
  udid: string,
  arch: string,
};

export function getFbsimctlDevices(): Observable<Array<Device>> {
  return Observable.interval(5000).startWith(0).switchMap(() =>
    runCommand('fbsimctl', ['--json', '--devices', '--format=%n%u%a', 'list'])
      .map(parseDevicesFromFbsimctlOutput)
      // Users may not have fbsimctl installed. If the command failed, just return an empty list.
      .catch(error => Observable.of([]))
      .share(),
  );
}

export function getFbsimctlSimulators(): Observable<Array<Simulator>> {
  return Observable.interval(5000).startWith(0).switchMap(() =>
    runCommand('fbsimctl', [
      '--json',
      '--simulators',
      '--format=%n%u%s%o%a',
      'list',
    ])
      .map(parseSimulatorsFromFbsimctlOutput)
      .catch(error => getSimulators())
      // Users may not have fbsimctl installed. Fall back to xcrun simctl in that case.
      .share(),
  );
}

export const getSimulators: () => Observable<Array<Simulator>> = memoize(() =>
  runCommand('xcrun', ['simctl', 'list', 'devices'])
    .map(parseSimulatorsFromSimctlOutput)
    .catch(error =>
      // Users may not have xcrun installed. If the command failed, just return an empty list.
      Observable.of([]),
    )
    .share(),
);

function parseSimulatorsFromFbsimctlOutput(output: string): Array<Simulator> {
  const simulators = [];

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
    const simulator = event.subject;
    const {state, os, name, udid, arch} = simulator;
    if (!state || !os || !name || !udid || !arch) {
      return;
    }

    if (!simulator.os.match(/^iOS (.+)$/)) {
      return;
    }

    simulators.push({
      name,
      udid,
      state: validateState(state),
      os,
      arch,
    });
  });

  return simulators;
}

function parseDevicesFromFbsimctlOutput(output: string): Array<Device> {
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
    const {name, udid, arch} = device;
    if (!name || !udid || !arch) {
      return;
    }

    devices.push({name, udid, arch});
  });

  return devices;
}

export function parseSimulatorsFromSimctlOutput(
  output: string,
): Array<Simulator> {
  const simulators = [];
  let currentOS = null;

  output.split('\n').forEach(line => {
    const section = line.match(/^-- (.+) --$/);
    if (section) {
      const header = section[1].match(/^iOS (.+)$/);
      if (header) {
        currentOS = header[1];
      } else {
        currentOS = null;
      }
      return;
    }

    const simulator = line.match(
      /^[ ]*([^()]+) \(([^()]+)\) \((Creating|Booting|Shutting Down|Shutdown|Booted)\)/,
    );
    // flowlint-next-line sketchy-null-string:off
    if (simulator && currentOS) {
      const [, name, udid, state] = simulator;
      const arch = name.match(/^(iPhone (5$|5C|4)|iPad Retina)/)
        ? 'i386'
        : 'x86_64';
      simulators.push({
        name,
        udid,
        state: validateState(state),
        os: currentOS,
        arch,
      });
    }
  });

  return simulators;
}

function validateState(rawState: ?string): ?SimulatorState {
  switch (rawState) {
    case 'Creating':
      return 'CREATING';
    case 'Booting':
      return 'BOOTING';
    case 'Shutting Down':
      return 'SHUTTING_DOWN';
    case 'Shutdown':
      return 'SHUT_DOWN';
    case 'Booted':
      return 'BOOTED';
    default:
      return null;
  }
}
