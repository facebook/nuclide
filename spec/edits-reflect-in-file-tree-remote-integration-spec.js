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

import {describeRemote} from './utils/remotable-tests';
import {runTest} from './utils/edits-reflect-in-file-tree-common';

describeRemote(
  'Remote edits reflect in file tree Integration Test',
  context => {
    runTest(context);
  },
);
