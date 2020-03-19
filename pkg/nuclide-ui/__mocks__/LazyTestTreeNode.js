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

import {LazyTreeNode} from '../LazyTreeNode';

export class LazyTestTreeNode extends LazyTreeNode {
  constructor(
    item: any,
    parent: ?LazyTreeNode,
    isContainer: boolean,
    fetchChildren: ?(node: LazyTreeNode) => Promise<any>,
  ) {
    // Test tree nodes that provide no `fetchChildren` get a default fetcher that returns nothing.
    const localFetchChildren = fetchChildren || (() => Promise.resolve());
    super(item, parent, isContainer, localFetchChildren);
  }

  getLabel(): string {
    return this.__item.label;
  }
}
