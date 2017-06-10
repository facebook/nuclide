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

import OpenFileNameProvider from './OpenFileNameProvider';

export function registerProvider(): Provider {
  return OpenFileNameProvider;
}
