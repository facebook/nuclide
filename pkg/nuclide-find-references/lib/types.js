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

import type {Reference} from './rpc-types';

export type ReferenceGroup = {
  references: Array<Reference>,
  // Start and end range of the preview text.
  startLine: number,
  endLine: number,
};

export type FileReferences = {
  uri: string,
  grammar: Object /* atom$Grammar */,
  previewText: Array<string>,
  refGroups: Array<ReferenceGroup>,
};
