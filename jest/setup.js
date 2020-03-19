/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

jest.mock('nuclide-commons/analytics');
jest.mock('log4js');

if (process.env.SANDCASTLE != null) {
  // We still have a lot of flaky tests. If any of them fail, we retry to make sure
  // they are actually failing. Only run it in sandcastle, because it can introduce
  // a lot of confusion during development.
  jest.retryTimes(2);
}

global.NUCLIDE_DO_NOT_LOG = true;
