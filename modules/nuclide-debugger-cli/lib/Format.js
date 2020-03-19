/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

export default function leftPad(
  s: string,
  size: number,
  pad: string = ' ',
): string {
  if (s.length >= size) {
    return s;
  }

  const padded = pad.repeat(size) + s;
  return padded.substr(padded.length - size);
}
