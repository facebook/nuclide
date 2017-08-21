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

export type SimpleProcess = {
  user: string,
  pid: string,
  name: string,
};

export type AndroidJavaProcess = SimpleProcess;

export type DebugBridgeType = 'adb' | 'sdb';

export type DeviceId = {name: string, port: number};

export type DeviceDescription = {|
  name: string,
  port: number,
  architecture: string,
  apiVersion: string,
  model: string,
|};

export type Process = {
  user: string,
  pid: number,
  name: string,
  cpuUsage: ?number,
  memUsage: ?number,
  isJava: boolean,
};

export type DebugBridgeConfig = {path: string, ports: Array<number>};

export type DebugBridgeFullConfig = {
  active: ?string,
  all: Array<string>,
  ports: Array<number>,
};
