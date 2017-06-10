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

export const REVEAL_FILE_ON_SWITCH_SETTING =
  'nuclide-file-tree.revealFileOnSwitch';
export const SHOW_OPEN_FILE_CONFIG_KEY = 'nuclide-file-tree.showOpenFiles';
export const SHOW_UNCOMMITTED_CHANGES_CONFIG_KEY =
  'nuclide-file-tree.showUncommittedChanges';
export const SHOW_UNCOMMITTED_CHANGES_KIND_CONFIG_KEY =
  'nuclide-file-tree.showUncommittedChangesKind';

export type ShowUncommittedChangesKindValue =
  | 'Uncommitted changes'
  | 'Head changes'
  | 'Stack changes';

export const ShowUncommittedChangesKind = Object.freeze({
  UNCOMMITTED: 'Uncommitted changes',
  HEAD: 'Head changes',
  STACK: 'Stack changes',
});

// This is to work around flow's missing support of enums.
(ShowUncommittedChangesKind: {[key: string]: ShowUncommittedChangesKindValue});

export const WORKSPACE_VIEW_URI = 'atom://nuclide/file-tree';
