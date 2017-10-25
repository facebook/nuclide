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

// $FlowFixMe(>=0.53.0) Flow suppress
import type React from 'react';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {StatusCodeNumberValue} from '../../nuclide-hg-rpc/lib/HgService';
import type {WorkingSet} from '../../nuclide-working-sets-common';
import type {WorkingSetsStore} from '../../nuclide-working-sets/lib/types';

import Dispatcher from '../../commons-node/Dispatcher';

export type FileTreeAction =
  | {
      actionType: 'COLLAPSE_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'COLLAPSE_NODE_DEEP',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'DELETE_SELECTED_NODES',
    }
  | {
      actionType: 'EXPAND_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'SET_EXCLUDE_VCS_IGNORED_PATHS',
      excludeVcsIgnoredPaths: boolean,
    }
  | {
      actionType: 'EXPAND_NODE_DEEP',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'SET_CWD',
      rootKey: ?NuclideUri,
    }
  | {
      actionType: 'SET_HIDE_IGNORED_NAMES',
      hideIgnoredNames: boolean,
    }
  | {
      actionType: 'SET_IS_CALCULATING_CHANGES',
      isCalculatingChanges: boolean,
    }
  | {
      actionType: 'SET_IGNORED_NAMES',
      ignoredNames: Array<string>,
    }
  | {
      actionType: 'SET_ROOT_KEYS',
      rootKeys: Array<NuclideUri>,
    }
  | {
      actionType: 'SET_TRACKED_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'CLEAR_TRACKED_NODE',
    }
  | {
      actionType: 'CLEAR_TRACKED_NODE_IF_NOT_LOADING',
    }
  | {
      actionType: 'START_REORDER_DRAG',
      draggedRootKey: NuclideUri,
    }
  | {
      actionType: 'END_REORDER_DRAG',
    }
  | {
      actionType: 'REORDER_DRAG_INTO',
      dragTargetNodeKey: NuclideUri,
    }
  | {
      actionType: 'REORDER_ROOTS',
    }
  | {
      actionType: 'MOVE_TO_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'SET_DROP_TARGET_NODE',
    }
  | {
      actionType: 'SET_USE_PREVIEW_TABS',
      usePreviewTabs: boolean,
    }
  | {
      actionType: 'SET_FOCUS_EDITOR_ON_FILE_SELECTION',
      focusEditorOnFileSelection: boolean,
    }
  | {
      actionType: 'SET_USE_PREFIX_NAV',
      usePrefixNav: boolean,
    }
  | {
      actionType: 'SET_AUTO_EXPAND_SINGLE_CHILD',
      autoExpandSingleChild: boolean,
    }
  | {
      actionType: 'SET_VCS_STATUSES', // VCS = version control system
      rootKey: NuclideUri,
      vcsStatuses: {[path: NuclideUri]: StatusCodeNumberValue},
    }
  | {
      actionType: 'SET_REPOSITORIES',
      // Immutable.Set<atom$Repository>, but since we don't have typedefs for immutable let's just be
      // honest here.
      repositories: any,
    }
  | {
      actionType: 'SET_WORKING_SET',
      workingSet: WorkingSet,
    }
  | {
      actionType: 'SET_OPEN_FILES_WORKING_SET',
      openFilesWorkingSet: WorkingSet,
    }
  | {
      actionType: 'SET_WORKING_SETS_STORE',
      workingSetsStore: ?WorkingSetsStore,
    }
  | {
      actionType: 'START_EDITING_WORKING_SET',
      editedWorkingSet: WorkingSet,
    }
  | {
      actionType: 'FINISH_EDITING_WORKING_SET',
    }
  | {
      actionType: 'CHECK_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'UNCHECK_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'SET_DRAG_HOVERED_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'UNHOVER_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'SET_SELECTED_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'SET_FOCUSED_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'ADD_SELECTED_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'UNSELECT_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'RANGE_SELECT_TO_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'RANGE_SELECT_UP',
    }
  | {
      actionType: 'RANGE_SELECT_DOWN',
    }
  | {
      actionType: 'MOVE_SELECTION_UP',
    }
  | {
      actionType: 'MOVE_SELECTION_DOWN',
    }
  | {
      actionType: 'MOVE_SELECTION_TO_TOP',
    }
  | {
      actionType: 'MOVE_SELECTION_TO_BOTTOM',
    }
  | {
      actionType: 'ENSURE_CHILD_NODE',
      nodeKey: NuclideUri,
    }
  | {
      actionType: 'CLEAR_FILTER',
    }
  | {
      actionType: 'ADD_EXTRA_PROJECT_SELECTION_CONTENT',
      content: React.Element<any>,
    }
  | {
      actionType: 'REMOVE_EXTRA_PROJECT_SELECTION_CONTENT',
      content: React.Element<any>,
    }
  | {
      actionType: 'SET_FOLDERS_EXPANDED',
      foldersExpanded: boolean,
    }
  | {
      actionType: 'SET_OPEN_FILES_EXPANDED',
      openFilesExpanded: boolean,
    }
  | {
      actionType: 'SET_UNCOMMITTED_CHANGES_EXPANDED',
      uncommittedChangesExpanded: boolean,
    }
  | {
      actionType: 'INVALIDATE_REMOVED_FOLDER',
    }
  | {
      actionType: 'SET_TARGET_NODE',
      rootKey: NuclideUri,
      nodeKey: NuclideUri,
    };

export const ActionTypes = Object.freeze({
  COLLAPSE_NODE: 'COLLAPSE_NODE',
  COLLAPSE_NODE_DEEP: 'COLLAPSE_NODE_DEEP',
  DELETE_SELECTED_NODES: 'DELETE_SELECTED_NODES',
  EXPAND_NODE: 'EXPAND_NODE',
  SET_EXCLUDE_VCS_IGNORED_PATHS: 'SET_EXCLUDE_VCS_IGNORED_PATHS',
  EXPAND_NODE_DEEP: 'EXPAND_NODE_DEEP',
  SET_CWD: 'SET_CWD',
  SET_HIDE_IGNORED_NAMES: 'SET_HIDE_IGNORED_NAMES',
  SET_IS_CALCULATING_CHANGES: 'SET_IS_CALCULATING_CHANGES',
  SET_IGNORED_NAMES: 'SET_IGNORED_NAMES',
  SET_ROOT_KEYS: 'SET_ROOT_KEYS',
  SET_TRACKED_NODE: 'SET_TRACKED_NODE',
  CLEAR_TRACKED_NODE: 'CLEAR_TRACKED_NODE',
  CLEAR_TRACKED_NODE_IF_NOT_LOADING: 'CLEAR_TRACKED_NODE_IF_NOT_LOADING',
  START_REORDER_DRAG: 'START_REORDER_DRAG',
  END_REORDER_DRAG: 'END_REORDER_DRAG',
  REORDER_DRAG_INTO: 'REORDER_DRAG_INTO',
  REORDER_ROOTS: 'REORDER_ROOTS',
  MOVE_TO_NODE: 'MOVE_TO_NODE',
  SET_DROP_TARGET_NODE: 'SET_DROP_TARGET_NODE',
  SET_USE_PREVIEW_TABS: 'SET_USE_PREVIEW_TABS',
  SET_USE_PREFIX_NAV: 'SET_USE_PREFIX_NAV',
  SET_AUTO_EXPAND_SINGLE_CHILD: 'SET_AUTO_EXPAND_SINGLE_CHILD',
  SET_FOCUS_EDITOR_ON_FILE_SELECTION: 'SET_FOCUS_EDITOR_ON_FILE_SELECTION',
  SET_VCS_STATUSES: 'SET_VCS_STATUSES',
  SET_REPOSITORIES: 'SET_REPOSITORIES',
  SET_WORKING_SET: 'SET_WORKING_SET',
  SET_OPEN_FILES_WORKING_SET: 'SET_OPEN_FILES_WORKING_SET',
  SET_WORKING_SETS_STORE: 'SET_WORKING_SETS_STORE',
  START_EDITING_WORKING_SET: 'START_EDITING_WORKING_SET',
  FINISH_EDITING_WORKING_SET: 'FINISH_EDITING_WORKING_SET',
  CHECK_NODE: 'CHECK_NODE',
  UNCHECK_NODE: 'UNCHECK_NODE',
  SET_DRAG_HOVERED_NODE: 'SET_DRAG_HOVERED_NODE',
  UNHOVER_NODE: 'UNHOVER_NODE',
  SET_SELECTED_NODE: 'SET_SELECTED_NODE',
  SET_FOCUSED_NODE: 'SET_FOCUSED_NODE',
  ADD_SELECTED_NODE: 'ADD_SELECTED_NODE',
  UNSELECT_NODE: 'UNSELECT_NODE',
  RANGE_SELECT_TO_NODE: 'RANGE_SELECT_TO_NODE',
  RANGE_SELECT_UP: 'RANGE_SELECT_UP',
  RANGE_SELECT_DOWN: 'RANGE_SELECT_DOWN',
  MOVE_SELECTION_UP: 'MOVE_SELECTION_UP',
  MOVE_SELECTION_DOWN: 'MOVE_SELECTION_DOWN',
  MOVE_SELECTION_TO_TOP: 'MOVE_SELECTION_TO_TOP',
  MOVE_SELECTION_TO_BOTTOM: 'MOVE_SELECTION_TO_BOTTOM',
  ENSURE_CHILD_NODE: 'ENSURE_CHILD_NODE',
  CLEAR_FILTER: 'CLEAR_FILTER',
  ADD_EXTRA_PROJECT_SELECTION_CONTENT: 'ADD_EXTRA_PROJECT_SELECTION_CONTENT',
  REMOVE_EXTRA_PROJECT_SELECTION_CONTENT:
    'REMOVE_EXTRA_PROJECT_SELECTION_CONTENT',
  SET_OPEN_FILES_EXPANDED: 'SET_OPEN_FILES_EXPANDED',
  SET_UNCOMMITTED_CHANGES_EXPANDED: 'SET_UNCOMMITTED_CHANGES_EXPANDED',
  SET_FOLDERS_EXPANDED: 'SET_FOLDERS_EXPANDED',
  INVALIDATE_REMOVED_FOLDER: 'INVALIDATE_REMOVED_FOLDER',
  SET_TARGET_NODE: 'SET_TARGET_NODE',
});

// Flow hack: Every FileTreeAction actionType must be in ActionTypes.
(('': $PropertyType<FileTreeAction, 'actionType'>): $Keys<typeof ActionTypes>);

let instance: ?FileTreeDispatcher;

export default class FileTreeDispatcher extends Dispatcher<FileTreeAction> {
  static getInstance(): FileTreeDispatcher {
    if (!instance) {
      instance = new FileTreeDispatcher();
    }
    return instance;
  }
}
