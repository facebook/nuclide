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

export type HHSearchPosition = {
  filename: string,
  line: number,
  char_start: number,
  char_end: number,
  scope: string,
  name: string,
  desc: string,
};
