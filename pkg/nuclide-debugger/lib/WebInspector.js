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

// Use this module to import the global `WebInspector` with types.

import type {WebInspector as WebInspectorType} from './types';

import invariant from 'assert';

// Prevent accidental import for this file when `WebInspector` is not in scope.
invariant(global.WebInspector != null);

export default (global.WebInspector: WebInspectorType);
