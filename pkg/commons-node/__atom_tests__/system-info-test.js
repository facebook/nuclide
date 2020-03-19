/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @emails oncall+nuclide
 * @flow strict-local
 * @format
 */

import {isRunningInTest} from 'nuclide-commons/system-info';

test('isRunningInTest', () => {
  expect(isRunningInTest()).toBe(true);
});
