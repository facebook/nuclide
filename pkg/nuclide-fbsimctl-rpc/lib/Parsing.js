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

import type {FbsimctlDevice, FbsimctlDeviceType} from './types';

export function parseFbsimctlJsonOutput(output: string): Array<FbsimctlDevice> {
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

function typeFromArch(arch: string): ?FbsimctlDeviceType {
  switch (arch) {
    case 'x86_64':
    case 'i386':
      return 'simulator';
    case 'arm64e':
    case 'arm64':
    case 'armv7':
    case 'armv7s':
      return 'physical_device';
    default:
      return null;
  }
}
