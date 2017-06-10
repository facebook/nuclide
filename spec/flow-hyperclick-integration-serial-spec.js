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

import {describeRemotableTest} from './utils/remotable-tests';

import {setup} from './utils/flow-common';
import {waitsForHyperclickResult} from './utils/hyperclick-common';

describeRemotableTest('Flow Hyperclick', context => {
  it('tests flow hyperclick example', () => {
    setup(context);

    waitsForHyperclickResult([3, 12], 'Foo.js', [2, 2]);
  });
});
