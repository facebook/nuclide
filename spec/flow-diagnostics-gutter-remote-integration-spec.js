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

import {describeRemote} from './utils/remotable-tests';
import {runTest} from './utils/flow-diagnostics-common';

describeRemote('Flow diagnostics gutter', context => {
  runTest(context);
});
