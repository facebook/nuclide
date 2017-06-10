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

import type {Metadata, Priority} from './types';

// Example: [ 01-14 17:14:44.285   640:  656 E/KernelUidCpuTimeReader ]
// eslint-disable-next-line max-len
const METADATA_REGEX = /^\[ (\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+):(?:(0x[a-f0-9]+)|\s*(\d+))\s+(V|D|I|W|E|F|S)\/(.+) ]$/;

export default function parseLogcatMetadata(line: string): ?Metadata {
  const match = line.match(METADATA_REGEX);

  if (match == null) {
    return null;
  }

  const [, time, pid, hexTid, decTid, priority, tag] = match;

  return {
    time,
    pid: parseInt(pid, 10),
    tid: hexTid == null ? parseInt(decTid, 10) : parseInt(hexTid, 16),
    priority: ((priority: any): Priority),
    tag,
  };
}
