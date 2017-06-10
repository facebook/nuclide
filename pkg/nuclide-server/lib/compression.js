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

import zlib from 'zlib';

export function compress(data: string): Buffer {
  return zlib.deflateSync(data);
}

export function decompress(data: Buffer): string {
  return zlib.inflateSync(data).toString('utf-8');
}
