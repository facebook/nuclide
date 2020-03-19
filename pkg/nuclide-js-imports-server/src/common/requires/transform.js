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

import type {Collection} from '../types/ast';
import type {SourceOptions} from '../options/SourceOptions.js';
import type {TransformKey} from '../types/transforms';

import addLeadingComments from './addLeadingComments';
import addMissingRequires from './addMissingRequires';
import addMissingTypes from './addMissingTypes';
import formatRequires from './formatRequires';
import removeLeadingComments from './removeLeadingComments';
import removeUnusedRequires from './removeUnusedRequires';
import removeUnusedTypes from './removeUnusedTypes';

export type ParsingInfo = {
  missingRequires: ?boolean,
  missingTypes: ?boolean,
};

/**
 * This is the collection of transforms that affect requires.
 */
function transform(root: Collection, options: SourceOptions): ParsingInfo {
  const blacklist: Set<TransformKey> = options.blacklist || new Set();
  let comments;
  let missingRequires;
  let missingTypes;
  if (!blacklist.has('requires.transferComments')) {
    comments = removeLeadingComments(root);
  }
  if (!blacklist.has('requires.removeUnusedRequires')) {
    removeUnusedRequires(root, options);
  }
  if (!blacklist.has('requires.addMissingRequires')) {
    missingRequires = addMissingRequires(root, options);
  }
  if (!blacklist.has('requires.removeUnusedTypes')) {
    removeUnusedTypes(root, options);
  }
  if (!blacklist.has('requires.addMissingTypes')) {
    missingTypes = addMissingTypes(root, options);
  }
  if (!blacklist.has('requires.formatRequires')) {
    formatRequires(root, options);
  }
  if (!blacklist.has('requires.transferComments')) {
    addLeadingComments(root, comments);
  }
  return {missingRequires, missingTypes};
}

export default transform;
