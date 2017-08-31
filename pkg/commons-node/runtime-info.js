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

import {
  getOsType,
  getAtomVersion,
  getNuclideVersion,
  isRunningInClient,
} from './system-info';
import os from 'os';
import uuid from 'uuid';
import {__DEV__} from 'nuclide-node-transpiler/lib/env';

export type RuntimeInformation = {
  sessionId: string,
  user: string,
  osType: string,
  timestamp: number,
  isClient: boolean,
  isDevelopment: boolean,
  atomVersion: string,
  nuclideVersion: string,
  installerPackageVersion: number,
  serverVersion: number,
  uptime: number,
};

let cachedInformation = null;

function getCacheableRuntimeInformation(): RuntimeInformation {
  if (cachedInformation !== null) {
    return cachedInformation;
  }

  cachedInformation = {
    sessionId: uuid.v4(),
    user: os.userInfo().username,
    osType: getOsType(),
    timestamp: 0,
    isClient: isRunningInClient(),
    isDevelopment: __DEV__,
    atomVersion: isRunningInClient() ? getAtomVersion() : '',
    nuclideVersion: getNuclideVersion(),
    installerPackageVersion: 0,
    uptime: 0,
    // TODO (chenshen) fill following information.
    serverVersion: 0,
  };

  return cachedInformation;
}

export function getRuntimeInformation(): RuntimeInformation {
  const runtimeInformation = {
    ...getCacheableRuntimeInformation(),
    timestamp: Date.now(),
    uptime: Math.floor(process.uptime() * 1000),
  };
  return runtimeInformation;
}

export {__DEV__};
