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

export type IOBytesStats = {
  stdin: number,
  stdout: number,
  stderr: number,
};

export type ChildProcessInfo = {
  pid: number,
  command: string,
  cpuPercentage: number,
  children: Array<ChildProcessInfo>,
  ioBytesStats: ?IOBytesStats,
};

export type HandlesByType = {[type: string]: Array<Object>};

export type HealthStats = {
  rss: number,
  heapUsed: number,
  heapTotal: number,
  heapPercentage: number,
  cpuPercentage: number,
  activeHandles: number,
  activeRequests: number,
  activeHandlesByType: HandlesByType,
};

export type PaneItemState = {
  stats: ?HealthStats,
  childProcessesTree: ?ChildProcessInfo,
  toolbarJewel?: string,
  updateToolbarJewel?: (value: string) => void,
};
