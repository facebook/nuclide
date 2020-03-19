/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

export default function getDisplayName(
  functionOrClass: Function | Class<*>,
): string {
  if (
    typeof functionOrClass.displayName === 'string' &&
    functionOrClass.displayName !== ''
  ) {
    return functionOrClass.displayName;
  } else if (
    typeof functionOrClass.name === 'string' &&
    functionOrClass.name !== ''
  ) {
    return functionOrClass.name;
  }

  return 'Unknown';
}
