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

export type IdbDeviceState =
  | 'Creating'
  | 'Booting'
  | 'Shutting Down'
  | 'Shutdown'
  | 'Booted';

export type IdbDevice = {|
  name: string,
  udid: string,
  state: IdbDeviceState,
  type: IdbDeviceType,
  osVersion: string,
  architecture: string,
  daemonHost: string,
  daemonPort: number,
|};

export type IdbDeviceType = 'simulator' | 'device';
