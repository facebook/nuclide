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

import type {VsAdapterType} from './types';

export const VsAdapterTypes = Object.freeze({
  HHVM: 'hhvm',
  PYTHON: 'python',
  NODE: 'node',
});

// This is to work around flow's missing support of enums.
(VsAdapterTypes: {[key: string]: VsAdapterType});
