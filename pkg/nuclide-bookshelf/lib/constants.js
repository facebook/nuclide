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

import type {
  ActionTypeValue,
  ActiveShortHeadChangeBehaviorValue,
} from './types';

export const ActionType = Object.freeze({
  ADD_PROJECT_REPOSITORY: 'add-project-repository',
  COMPLETE_RESTORING_REPOSITORY_STATE: 'complete-restoring-repository-state',
  REMOVE_PROJECT_REPOSITORY: 'remove-project-repository',
  RESTORE_PANE_ITEM_STATE: 'restore-pane-item-state',
  START_RESTORING_REPOSITORY_STATE: 'start-restoring-repository-state',
  UPDATE_PANE_ITEM_STATE: 'update-pane-item-state',
  UPDATE_REPOSITORY_BOOKMARKS: 'update-repository-bookmarks',
});

// This is to work around flow's missing support of enums.
(ActionType: {[key: string]: ActionTypeValue});

export const ActiveShortHeadChangeBehavior = Object.freeze({
  ALWAYS_IGNORE: 'Always Ignore',
  ALWAYS_RESTORE: 'Always Restore',
  PROMPT_TO_RESTORE: 'Prompt to Restore',
});

(ActiveShortHeadChangeBehavior: {
  [key: string]: ActiveShortHeadChangeBehaviorValue,
});

export const ACTIVE_SHORTHEAD_CHANGE_BEHAVIOR_CONFIG =
  'nuclide-bookshelf.changeActiveBookmarkBehavior';

export const EMPTY_SHORTHEAD = '';
