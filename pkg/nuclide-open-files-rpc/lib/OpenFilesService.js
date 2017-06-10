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

import type {FileNotifier} from './rpc-types';

import {FileCache} from './FileCache';

export async function initialize(): Promise<FileNotifier> {
  return new FileCache();
}
