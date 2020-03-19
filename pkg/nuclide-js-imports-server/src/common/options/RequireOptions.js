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

import type {AbsolutePath} from '../types/common';

/**
 * These are the options that are necessary to get a require out of a ModuleMap.
 */
export type RequireOptions = {
  sourcePath?: AbsolutePath,
  typeImport?: boolean,
  jsxSuffix?: boolean,
};
