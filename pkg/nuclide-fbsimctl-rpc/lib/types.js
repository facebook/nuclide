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

export type FbsimctlDeviceState =
  | 'Creating'
  | 'Booting'
  | 'Shutting Down'
  | 'Shutdown'
  | 'Booted';

export type FbsimctlDevice = {|
  name: string,
  udid: string,
  state: FbsimctlDeviceState,
  os: string,
  arch: string,
  type: FbsimctlDeviceType,
|};

export type FbsimctlDeviceType = 'simulator' | 'physical_device';
