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

import {describeLocal} from './utils/remotable-tests';
import {runTest} from './utils/quick-open-provider-cycle-common';

describeLocal('Quick Open Providers', context => {
  runTest(context);
});
