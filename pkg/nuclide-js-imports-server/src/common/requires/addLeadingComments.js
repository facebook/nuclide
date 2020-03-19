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

import type {Collection, Node} from '../types/ast';

import FirstNode from '../utils/FirstNode';
import reprintComment from '../utils/reprintComment';

function addLeadingComments(root: Collection, comments: ?Array<Node>): void {
  if (!comments || comments.length === 0) {
    return;
  }

  const firstPath = FirstNode.get(root);
  if (!firstPath) {
    return;
  }
  const first = firstPath.node;
  first.comments = first.comments ? comments.concat(first.comments) : comments;
  first.comments = first.comments.map(comment => reprintComment(comment));
  firstPath.replace(first);
}

export default addLeadingComments;
