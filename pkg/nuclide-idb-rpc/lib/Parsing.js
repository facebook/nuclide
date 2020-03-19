/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

import type {IdbDevice} from './types';

export function parseIdbJsonOutput(output: string): Array<IdbDevice> {
  const devices = [];

  output.split('\n').forEach(line => {
    let device;
    try {
      device = JSON.parse(line);
    } catch (e) {
      return;
    }

    const {
      name,
      udid,
      state,
      type,
      os_version,
      architecture,
      daemon_host,
      daemon_port,
    } = device;

    if (
      !name ||
      !udid ||
      !state ||
      (type !== 'simulator' && type !== 'device') ||
      !os_version ||
      !architecture ||
      !daemon_host ||
      !daemon_port
    ) {
      return;
    }

    // only list iOS devices
    if (!os_version.match(/^iOS (.+)$/)) {
      return;
    }

    devices.push({
      architecture,
      daemonHost: daemon_host,
      daemonPort: daemon_port,
      name,
      osVersion: os_version,
      state,
      type,
      udid,
    });
  });

  return devices;
}
