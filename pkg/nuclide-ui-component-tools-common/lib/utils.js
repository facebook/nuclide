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

export function removePrefix(prefix: string, input: string) {
  if (input.indexOf(prefix) === 0) {
    return input.substr(prefix.length);
  }
  return input;
}
