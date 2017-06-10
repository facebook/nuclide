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

import Immutable from 'immutable';
import {LazyTreeNode} from '../../../nuclide-ui/LazyTreeNode';

export default class TestClassTreeNode extends LazyTreeNode {
  constructor(testClass: Object) {
    super(testClass, null, true, async () => Immutable.List.of());
  }

  getLabel(): string {
    return this.getItem().name;
  }
}
