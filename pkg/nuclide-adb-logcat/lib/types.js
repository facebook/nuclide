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

export type Priority = 'V' | 'D' | 'I' | 'W' | 'E' | 'F' | 'S';

export type LogcatEntry = {
  message: string,
  metadata: ?Metadata,
};

export type Metadata = {
  time: string,
  pid: number,
  tid: number,
  priority: Priority,
  tag: string,
};
