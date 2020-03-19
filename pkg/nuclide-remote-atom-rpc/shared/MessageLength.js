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

export function restrictLength(input: string): string {
  const maxLength = 100000;
  if (input.length <= maxLength) {
    return input;
  }
  return (
    input.substring(0, maxLength) +
    `...[truncated to ${maxLength.toLocaleString()} characters]`
  );
}
