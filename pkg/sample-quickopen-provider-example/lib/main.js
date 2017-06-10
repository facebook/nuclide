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

import type {Provider} from '../../nuclide-quick-open/lib/types';

import ExampleProvider from './ExampleProvider';

export function registerProvider(): Provider {
  return ExampleProvider;
}

export function activate(state: ?Object) {}

export function deactivate() {}
