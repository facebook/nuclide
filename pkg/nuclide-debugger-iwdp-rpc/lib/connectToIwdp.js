'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {logger} from './logger';
import xfetch from '../../commons-node/xfetch';
import {observeProcess, safeSpawn, createArgsForScriptCommand} from '../../commons-node/process';
import {Observable} from 'rxjs';

import type {IosDeviceInfo} from './types';

const {log} = logger;
const CONNECTED_TO_DEVICE_REGEX = /Connected :([0-9]+) to/;
const POLLING_INTERVAL = 2000;

export function connectToIwdp(): Observable<IosDeviceInfo> {
  return observeProcess(() => {
    // Question: why are we running the debug proxy under `script`?
    // Answer: The iwdp binary will aggressively buffer stdout, unless it thinks it is running
    // under a terminal environment.  `script` runs the binary in a terminal-like environment,
    // and gives us less-aggressive buffering behavior, i.e. newlines cause stdout to be flushed.
    const newArgs = createArgsForScriptCommand('ios_webkit_debug_proxy', ['--no-frontend']);
    return safeSpawn('script', newArgs);
  }).mergeMap(message => {
    if (message.kind === 'stdout') {
      const {data} = message;
      const matches = CONNECTED_TO_DEVICE_REGEX.exec(data);
      if (matches != null) {
        const port = Number(matches[1]);
        log(`Fetching device data because we got ${data}`);
        return Observable.interval(POLLING_INTERVAL).switchMap(() => fetchDeviceData(port));
      }
      if (data.startsWith('Listing devices on :')) {
        log(`IWDP Connected!: ${data}`);
      }
      return Observable.never();
    } else if (message.kind === 'exit') {
      return Observable.empty();
    } else {
      return Observable.throw(
        new Error(`Error for ios_webkit_debug_proxy: ${JSON.stringify(message)}`),
      );
    }
  })
    .mergeMap(deviceInfos => deviceInfos)
    .distinct(deviceInfo => deviceInfo.webSocketDebuggerUrl);
}

async function fetchDeviceData(port: number): Promise<Array<IosDeviceInfo>> {
  const response = await xfetch(`http://localhost:${port}/json`, {});
  const responseText = await response.text();
  return JSON.parse(responseText);
}
