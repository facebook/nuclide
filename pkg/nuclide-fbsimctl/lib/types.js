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

export type State =
  | 'Creating'
  | 'Booting'
  | 'Shutting Down'
  | 'Shutdown'
  | 'Booted'
  // Physical currently always have an Unknown state
  | 'Unknown';

export type Device = {
  name: string,
  udid: string,
  state: State,
  os: string,
  arch: string,
  type: DeviceType,
};

export type DeviceType = 'simulator' | 'physical_device';
