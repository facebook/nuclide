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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  SetCustomAdbPathAction,
  SetCustomSdbPathAction,
  SetAdbPortAction,
} from '../types';

export const SET_CUSTOM_ADB_PATH = 'SET_CUSTOM_ADB_PATH';
export const SET_CUSTOM_SDB_PATH = 'SET_CUSTOM_SDB_PATH';
export const SET_ADB_PORT = 'SET_ADB_PORT';

export function setCustomAdbPath(
  host: NuclideUri,
  path: ?string,
): SetCustomAdbPathAction {
  return {
    type: SET_CUSTOM_ADB_PATH,
    payload: {host, path},
  };
}

export function setAdbPort(host: NuclideUri, port: ?string): SetAdbPortAction {
  return {
    type: SET_ADB_PORT,
    payload: {host, port},
  };
}

export function setCustomSdbPath(
  host: NuclideUri,
  path: ?string,
): SetCustomSdbPathAction {
  return {
    type: SET_CUSTOM_SDB_PATH,
    payload: {host, path},
  };
}
