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

import type CwdApi from '../../../nuclide-current-working-directory/lib/CwdApi';
// $FlowFixMe(>=0.53.0) Flow suppress
import type React from 'react';
import type {InitialData, Roots} from '../types';

import invariant from 'assert';
import * as FileTreeHelpers from '../FileTreeHelpers';
import * as Selectors from '../redux/Selectors';
import {FileTreeNode} from '../FileTreeNode';
import * as Immutable from 'immutable';
import {matchesFilter} from '../FileTreeFilterHelper';
import {Minimatch} from 'minimatch';
import {WorkingSet} from '../../../nuclide-working-sets-common';
import {HistogramTracker} from 'nuclide-analytics';
import nullthrows from 'nullthrows';
import {RangeKey, SelectionRange} from '../FileTreeSelectionRange';
import * as Actions from '../redux/Actions';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {WorkingSetsStore} from '../../../nuclide-working-sets/lib/types';
import type {StatusCodeNumberValue} from '../../../nuclide-hg-rpc/lib/types';
import type {AppState, Action} from '../types';

const actionTrackers: Map<string, HistogramTracker> = new Map();

// TODO: Don't `export default` an object.
const {updateNodeAtRoot, updateNodeAtAllRoots} = FileTreeHelpers;

const DEFAULT_STATE: AppState = {
  // Used to ensure the version we serialized is the same version we are deserializing.
  VERSION: 1,

  _roots: Immutable.OrderedMap(),

  _generatedOpenChangedFiles: Immutable.Map(),
  _reorderPreviewStatus: null,

  _usePrefixNav: false,
  _autoExpandSingleChild: true,
  _isLoadingMap: Immutable.Map(),
  _repositories: Immutable.Set(),

  excludeVcsIgnoredPaths: true,
  hideIgnoredNames: true,
  hideVcsIgnoredPaths: true,
  ignoredPatterns: Immutable.Set(),
  workingSet: new WorkingSet(),
  isEditingWorkingSet: false,
  editedWorkingSet: new WorkingSet(),
  openFilesWorkingSet: new WorkingSet(),

  _workingSetsStore: null,
  _filter: '',
  _extraProjectSelectionContent: Immutable.List(),
  _foldersExpanded: true,
  _openFilesExpanded: true,
  _uncommittedChangesExpanded: true,
  _selectionRange: null,
  _targetNodeKeys: null,
  _isCalculatingChanges: false,

  _maxComponentWidth: -1,

  _selectedUris: new Immutable.Map(),
  _focusedUris: new Immutable.Map(),

  _cwdApi: null,
  _cwdKey: null,
  _trackedRootKey: null,
  _trackedNodeKey: null,
  remoteTransferService: null,

  vcsStatuses: Immutable.Map(),
  usePreviewTabs: false,
  focusEditorOnFileSelection: true,
  currentWorkingRevision: null,
};

function reduceState(state_: AppState, action: Action): AppState {
  const state = state_ || DEFAULT_STATE;
  switch (action.type) {
    case Actions.SET_INITIAL_DATA:
      return setInitialData(state, action.data);
    case Actions.CLEAR_SELECTION_RANGE:
      return clearSelectionRange(state);
    case Actions.CLEAR_DRAG_HOVER:
      return clearDragHover(state);
    case Actions.CLEAR_SELECTION:
      return clearSelection(state);
    case Actions.SET_CWD:
      return setCwdKey(state, action.rootKey);
    case Actions.SET_CWD_API:
      return setCwdApi(state, action.cwdApi);
    case Actions.SET_TRACKED_NODE:
      return setTrackedNode(state, action.rootKey, action.nodeKey);
    case Actions.CLEAR_TRACKED_NODE:
      return clearTrackedNode(state);
    case Actions.CLEAR_TRACKED_NODE_IF_NOT_LOADING:
      return clearTrackedNodeIfNotLoading(state);
    case Actions.START_REORDER_DRAG:
      return startReorderDrag(state, action.draggedRootKey);
    case Actions.END_REORDER_DRAG:
      return endReorderDrag(state);
    case Actions.REORDER_DRAG_INTO:
      return reorderDragInto(state, action.dragTargetNodeKey);
    case Actions.COLLAPSE_NODE:
      return collapseNode(state, action.rootKey, action.nodeKey);
    case Actions.SET_EXCLUDE_VCS_IGNORED_PATHS:
      return setExcludeVcsIgnoredPaths(state, action.excludeVcsIgnoredPaths);
    case Actions.SET_HIDE_VCS_IGNORED_PATHS:
      return setHideVcsIgnoredPaths(state, action.hideVcsIgnoredPaths);
    case Actions.SET_USE_PREVIEW_TABS:
      return setUsePreviewTabs(state, action.usePreviewTabs);
    case Actions.SET_FOCUS_EDITOR_ON_FILE_SELECTION:
      return setFocusEditorOnFileSelection(
        state,
        action.focusEditorOnFileSelection,
      );
    case Actions.SET_USE_PREFIX_NAV:
      return setUsePrefixNav(state, action.usePrefixNav);
    case Actions.SET_AUTO_EXPAND_SINGLE_CHILD:
      return setAutoExpandSingleChild(state, action.autoExpandSingleChild);
    case Actions.COLLAPSE_NODE_DEEP:
      return collapseNodeDeep(state, action.rootKey, action.nodeKey);
    case Actions.SET_HIDE_IGNORED_NAMES:
      return setHideIgnoredNames(state, action.hideIgnoredNames);
    case Actions.SET_IS_CALCULATING_CHANGES:
      return setIsCalculatingChanges(state, action.isCalculatingChanges);
    case Actions.SET_IGNORED_NAMES:
      return setIgnoredNames(state, action.ignoredNames);
    case Actions.SET_VCS_STATUSES:
      return setVcsStatuses(state, action.rootKey, action.vcsStatuses);
    case Actions.SET_REPOSITORIES:
      return setRepositories(state, action.repositories);
    case Actions.SET_WORKING_SET:
      return setWorkingSet(state, action.workingSet);
    case Actions.SET_OPEN_FILES_WORKING_SET:
      return setOpenFilesWorkingSet(state, action.openFilesWorkingSet);
    case Actions.SET_WORKING_SETS_STORE:
      return setWorkingSetsStore(state, action.workingSetsStore);
    case Actions.START_EDITING_WORKING_SET:
      return startEditingWorkingSet(state, action.editedWorkingSet);
    case Actions.FINISH_EDITING_WORKING_SET:
      return finishEditingWorkingSet(state);
    case Actions.CHECK_NODE:
      return checkNode(state, action.rootKey, action.nodeKey);
    case Actions.UNCHECK_NODE:
      return uncheckNode(state, action.rootKey, action.nodeKey);
    case Actions.SET_DRAG_HOVERED_NODE:
      return setDragHoveredNode(state, action.rootKey, action.nodeKey);
    case Actions.UNHOVER_NODE:
      return unhoverNode(state, action.rootKey, action.nodeKey);
    case Actions.SET_SELECTED_NODE:
      return setSelectedNode(state, action.rootKey, action.nodeKey);
    case Actions.SET_FOCUSED_NODE:
      return setFocusedNode(state, action.rootKey, action.nodeKey);
    case Actions.ADD_SELECTED_NODE:
      return addSelectedNode(state, action.rootKey, action.nodeKey);
    case Actions.UNSELECT_NODE:
      return unselectNode(state, action.rootKey, action.nodeKey);
    case Actions.MOVE_SELECTION_UP:
      return moveSelectionUp(state);
    case Actions.RANGE_SELECT_TO_NODE:
      return rangeSelectToNode(state, action.rootKey, action.nodeKey);
    case Actions.RANGE_SELECT_UP:
      return rangeSelectMove(state, 'up');
    case Actions.RANGE_SELECT_DOWN:
      return rangeSelectMove(state, 'down');
    case Actions.MOVE_SELECTION_DOWN:
      return moveSelectionDown(state);
    case Actions.MOVE_SELECTION_TO_TOP:
      return moveSelectionToTop(state);
    case Actions.MOVE_SELECTION_TO_BOTTOM:
      return moveSelectionToBottom(state);
    case Actions.CLEAR_FILTER:
      return clearFilter(state);
    case Actions.ADD_EXTRA_PROJECT_SELECTION_CONTENT:
      return addExtraProjectSelectionContent(state, action.content);
    case Actions.REMOVE_EXTRA_PROJECT_SELECTION_CONTENT:
      return removeExtraProjectSelectionContent(state, action.content);
    case Actions.SET_OPEN_FILES_EXPANDED:
      return setOpenFilesExpanded(state, action.openFilesExpanded);
    case Actions.SET_UNCOMMITTED_CHANGES_EXPANDED:
      return setUncommittedChangesExpanded(
        state,
        action.uncommittedChangesExpanded,
      );
    case Actions.SET_FOLDERS_EXPANDED:
      return setFoldersExpanded(state, action.foldersExpanded);
    case Actions.SET_TARGET_NODE:
      return setTargetNode(state, action.rootKey, action.nodeKey);
    case Actions.UPDATE_GENERATED_STATUSES:
      const {generatedFileTypes} = action;
      return {
        ...state,
        _generatedOpenChangedFiles: state._generatedOpenChangedFiles
          .merge(generatedFileTypes)
          // just drop any non-generated files from the map
          .filter(value => value !== 'manual'),
      };
    case Actions.ADD_FILTER_LETTER:
      return addFilterLetter(state, action.letter);
    case Actions.REMOVE_FILTER_LETTER:
      return removeFilterLetter(state);
    case Actions.SET_ROOTS:
      return setRoots(state, action.roots);
    case Actions.CLEAR_LOADING:
      return {
        ...state,
        _isLoadingMap: state._isLoadingMap.delete(action.nodeKey),
      };
    case Actions.SET_LOADING:
      return {
        ...state,
        _isLoadingMap: state._isLoadingMap.set(action.nodeKey, action.promise),
      };
    case Actions.GOT_REMOTE_TRANSFER_SERVICE:
      return {...state, remoteTransferService: action.remoteTransferService};
    case Actions.SELECT:
      return {
        ...state,
        _selectedUris: addNodes(state._selectedUris, [action.node]),
      };
    case Actions.UNSELECT:
      return {
        ...state,
        _selectedUris: deleteNodes(state._selectedUris, [action.node]),
      };
    case Actions.CLEAR_SELECTED:
      return clearSelected(state);
    case Actions.FOCUS:
      return {
        ...state,
        _focusedUris: addNodes(state._focusedUris, [action.node]),
      };
    case Actions.UNFOCUS:
      return {
        ...state,
        _focusedUris: deleteNodes(state._focusedUris, [action.node]),
      };
    case Actions.CLEAR_FOCUSED:
      return clearFocused(state);
    case Actions.CHANGE_WORKING_REVISION:
      return {
        ...state,
        currentWorkingRevision: action.revision,
      };
    default:
      break;
  }
  return state;
}

export default function(state: AppState, action: Action): AppState {
  const {performance} = global;
  const start = performance.now();

  const nextState = reduceState(state, action);

  const end = performance.now();

  let tracker = actionTrackers.get(action.type);
  if (tracker == null) {
    tracker = new HistogramTracker(`file-tree-action:${action.type}`, 1000, 10);
    actionTrackers.set(action.type, tracker);
  }

  tracker.track(end - start);
  return nextState;
}

function setInitialData(state: AppState, data: InitialData): AppState {
  const nextState = {...state};
  if (data.openFilesExpanded != null) {
    nextState._openFilesExpanded = data.openFilesExpanded;
  }

  if (data.uncommittedChangesExpanded != null) {
    nextState._uncommittedChangesExpanded = data.uncommittedChangesExpanded;
  }

  if (data.foldersExpanded != null) {
    nextState._foldersExpanded = data.foldersExpanded;
  }

  return setRoots(nextState, data.roots);
}

/**
 * Updates the roots, maintains their sibling relationships and fires the change event.
 */
function setRoots(state: AppState, roots: Roots): AppState {
  // Explicitly test for the empty case, otherwise configuration changes with an empty
  // tree will not emit changes.
  const changed = !Immutable.is(roots, state._roots) || roots.isEmpty();
  if (!changed) {
    return state;
  }
  const nextState = {...state};
  nextState._roots = roots;
  let prevRoot = null;
  roots.forEach(r => {
    r.prevSibling = prevRoot;
    if (prevRoot != null) {
      prevRoot.nextSibling = r;
    }
    prevRoot = r;
  });

  if (prevRoot != null) {
    prevRoot.nextSibling = null;
  }

  return nextState;
}

function clearSelectionRange(state: AppState): AppState {
  return {
    ...state,
    _selectionRange: null,
    _targetNodeKeys: null,
  };
}

function clearDragHover(state: AppState): AppState {
  const getNodeContainsDragHover = Selectors.getNodeContainsDragHover(state);
  return updateRoots(state, root => {
    return root.setRecursive(
      node => (getNodeContainsDragHover(node) ? null : node),
      node => node.setIsDragHovered(false),
    );
  });
}

/**
 * Use the update function to update one or more of the roots in the file tree
 */
function updateRoots(
  state: AppState,
  update: (root: FileTreeNode) => FileTreeNode,
): AppState {
  return setRoots(state, state._roots.map(update));
}

// Clear selections and focuses on all nodes except an optionally specified
// current node.
function clearSelection(state: AppState): AppState {
  return clearSelected(clearFocused(clearSelectionRange(state)));
}

function clearSelected(state: AppState): AppState {
  return {
    ...state,
    _selectedUris: Immutable.Map(),
  };
}

function clearFocused(state: AppState): AppState {
  return {
    ...state,
    _focusedUris: Immutable.Map(),
  };
}

function setCwdKey(state: AppState, cwdKey: ?NuclideUri): AppState {
  let nextState = {...state};
  const currentCwdKey = state._cwdKey;
  if (currentCwdKey != null) {
    nextState = setRoots(
      nextState,
      updateNodeAtAllRoots(nextState._roots, currentCwdKey, node =>
        node.setIsCwd(false),
      ),
    );
  }
  nextState._cwdKey = cwdKey;
  if (cwdKey != null) {
    nextState = setRoots(
      nextState,
      updateNodeAtAllRoots(nextState._roots, cwdKey, node =>
        node.setIsCwd(true),
      ),
    );
  }
  return nextState;
}

function setCwdApi(state: AppState, cwdApi: ?CwdApi): AppState {
  return {
    ...state,
    _cwdApi: cwdApi,
  };
}

function setTrackedNode(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  if (state._trackedRootKey !== rootKey || state._trackedNodeKey !== nodeKey) {
    return {
      ...state,
      _trackedRootKey: rootKey,
      _trackedNodeKey: nodeKey,
    };
  }
  return state;
}

function clearTrackedNode(state: AppState): AppState {
  if (state._trackedRootKey != null || state._trackedNodeKey != null) {
    return {
      ...state,
      _trackedRootKey: null,
      _trackedNodeKey: null,
    };
  }
  return state;
}

/**
 * Resets the node to be kept in view if no more data is being awaited. Safe to call many times
 * because it only changes state if a node is being tracked.
 */
function clearTrackedNodeIfNotLoading(state: AppState): AppState {
  if (
    /*
       * The loading map being empty is a heuristic for when loading has completed. It is inexact
       * because the loading might be unrelated to the tracked node, however it is cheap and false
       * positives will only last until loading is complete or until the user clicks another node in
       * the tree.
       */
    state._isLoadingMap.isEmpty()
  ) {
    // Loading has completed. Allow scrolling to proceed as usual.
    return clearTrackedNode(state);
  }
  return state;
}

function startReorderDrag(
  state: AppState,
  draggedRootKey: NuclideUri,
): AppState {
  const rootIdx = Selectors.getRootKeys(state).indexOf(draggedRootKey);
  if (rootIdx === -1) {
    return state;
  }
  const nextState = setRoots(
    state,
    updateNodeAtRoot(state._roots, draggedRootKey, draggedRootKey, node =>
      setNodeIsBeingReordered(node, true, n =>
        Selectors.getNodeShouldBeShown(state)(n),
      ),
    ),
  );
  return {
    ...nextState,
    _reorderPreviewStatus: {
      source: draggedRootKey,
      sourceIdx: rootIdx,
    },
  };
}

function endReorderDrag(state: AppState): AppState {
  if (state._reorderPreviewStatus == null) {
    return state;
  }
  const sourceRootKey = state._reorderPreviewStatus.source;
  const nextState = setRoots(
    state,
    updateNodeAtRoot(state._roots, sourceRootKey, sourceRootKey, node =>
      setNodeIsBeingReordered(node, false, n =>
        Selectors.getNodeShouldBeShown(state)(n),
      ),
    ),
  );
  return {
    ...nextState,
    _reorderPreviewStatus: null,
  };
}

function reorderDragInto(state: AppState, targetRootKey: NuclideUri): AppState {
  const reorderPreviewStatus = state._reorderPreviewStatus;
  const targetIdx = Selectors.getRootKeys(state).indexOf(targetRootKey);
  const targetRootNode = Selectors.getNode(state, targetRootKey, targetRootKey);
  if (
    reorderPreviewStatus == null ||
    targetIdx === -1 ||
    targetRootNode == null
  ) {
    return state;
  }

  let targetNode;
  if (targetIdx <= reorderPreviewStatus.sourceIdx) {
    targetNode = targetRootNode;
  } else {
    targetNode = Selectors.findLastRecursiveChild(state)(targetRootNode);
  }

  return {
    ...state,
    _reorderPreviewStatus: {
      ...state._reorderPreviewStatus,
      target: targetNode == null ? undefined : targetNode.uri,
      targetIdx,
    },
  };
}

function collapseNode(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  const nodesToUnselect = new Set();
  const nextState = setRoots(
    state,
    updateNodeAtRoot(state._roots, rootKey, nodeKey, node => {
      // Clear all selected nodes under the node being collapsed and dispose their subscriptions
      return node.setRecursive(
        childNode => {
          if (childNode.isExpanded) {
            return null;
          }
          return childNode;
        },
        childNode => {
          if (childNode.subscription != null) {
            childNode.subscription.dispose();
          }

          if (childNode.uri === node.uri) {
            return childNode.set({isExpanded: false, subscription: null});
          } else {
            nodesToUnselect.add(childNode);
            return childNode.set({subscription: null});
          }
        },
      );
    }),
  );

  let nextSelectedUris = nextState._selectedUris;
  nodesToUnselect.forEach(node => {
    nextSelectedUris = deleteNodes(nextSelectedUris, [node]);
  });
  return {
    ...nextState,
    _selectedUris: nextSelectedUris,
  };
}

function setExcludeVcsIgnoredPaths(
  state: AppState,
  excludeVcsIgnoredPaths: boolean,
): AppState {
  return {...state, excludeVcsIgnoredPaths};
}

function setHideVcsIgnoredPaths(
  state: AppState,
  hideVcsIgnoredPaths: boolean,
): AppState {
  return {...state, hideVcsIgnoredPaths};
}

function setUsePreviewTabs(state: AppState, usePreviewTabs: boolean): AppState {
  return {...state, usePreviewTabs};
}

function setFocusEditorOnFileSelection(
  state: AppState,
  focusEditorOnFileSelection: boolean,
): AppState {
  return {...state, focusEditorOnFileSelection};
}

function setUsePrefixNav(state: AppState, usePrefixNav: boolean): AppState {
  return {
    ...state,
    _usePrefixNav: usePrefixNav,
  };
}

function setAutoExpandSingleChild(
  state: AppState,
  autoExpandSingleChild: boolean,
): AppState {
  return {
    ...state,
    _autoExpandSingleChild: autoExpandSingleChild,
  };
}

function collapseNodeDeep(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  const nodesToUnselect = new Set();
  const nextState = setRoots(
    state,
    updateNodeAtRoot(state._roots, rootKey, nodeKey, node => {
      return node.setRecursive(/* prePredicate */ null, childNode => {
        if (childNode.subscription != null) {
          childNode.subscription.dispose();
        }

        if (childNode.uri !== node.uri) {
          nodesToUnselect.add(childNode);
          return childNode.set({
            isExpanded: false,
            subscription: null,
          });
        } else {
          return childNode.set({isExpanded: false, subscription: null});
        }
      });
    }),
  );
  return {
    ...nextState,
    _selectedUris: deleteNodes(nextState._selectedUris, nodesToUnselect),
  };
}

function setHideIgnoredNames(
  state: AppState,
  hideIgnoredNames: boolean,
): AppState {
  return {...state, hideIgnoredNames};
}

function setIsCalculatingChanges(
  state: AppState,
  isCalculatingChanges: boolean,
): AppState {
  return {
    ...state,
    _isCalculatingChanges: isCalculatingChanges,
  };
}

/**
 * Given a list of names to ignore, compile them into minimatch patterns and
 * update the store with them.
 */
function setIgnoredNames(
  state: AppState,
  ignoredNames: Array<string>,
): AppState {
  const ignoredPatterns = Immutable.Set(ignoredNames)
    .map(ignoredName => {
      if (ignoredName === '') {
        return null;
      }
      try {
        return new Minimatch(ignoredName, {matchBase: true, dot: true});
      } catch (error) {
        atom.notifications.addWarning(
          `Error parsing pattern '${ignoredName}' from "Settings" > "Ignored Names"`,
          {detail: error.message},
        );
        return null;
      }
    })
    .filter(pattern => pattern != null);
  return {...state, ignoredPatterns};
}

function setVcsStatuses(
  state: AppState,
  rootKey: NuclideUri,
  vcsStatuses: Map<NuclideUri, StatusCodeNumberValue>,
): AppState {
  return {
    ...state,
    vcsStatuses: state.vcsStatuses.set(rootKey, vcsStatuses),
  };
}

function setRepositories(
  state: AppState,
  repositories: Immutable.Set<atom$Repository>,
): AppState {
  return {
    ...state,
    _repositories: repositories,
  };
}

function setWorkingSet(state: AppState, workingSet: WorkingSet): AppState {
  return {...state, workingSet};
}

function setOpenFilesWorkingSet(
  state: AppState,
  openFilesWorkingSet: WorkingSet,
): AppState {
  return {
    ...state,
    openFilesWorkingSet,
  };
}

function setWorkingSetsStore(
  state: AppState,
  workingSetsStore: ?WorkingSetsStore,
): AppState {
  return {
    ...state,
    _workingSetsStore: workingSetsStore,
  };
}

function startEditingWorkingSet(
  state: AppState,
  editedWorkingSet: WorkingSet,
): AppState {
  return {
    ...state,
    editedWorkingSet,
    isEditingWorkingSet: true,
  };
}

function finishEditingWorkingSet(state: AppState): AppState {
  return {
    ...state,
    isEditingWorkingSet: false,
    editedWorkingSet: new WorkingSet(),
  };
}

function checkNode(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  if (!Selectors.getIsEditingWorkingSet(state)) {
    return state;
  }

  let node = Selectors.getNode(state, rootKey, nodeKey);
  if (node == null) {
    return state;
  }

  let uriToAppend = nodeKey; // Workaround flow's (over)aggressive nullability detection

  const allChecked = nodeParent => {
    return nodeParent.children.every(c => {
      return (
        !Selectors.getNodeShouldBeShown(state)(c) ||
        Selectors.getNodeCheckedStatus(state)(c) === 'checked' ||
        c === node
      );
    });
  };

  while (node.parent != null && allChecked(node.parent)) {
    node = node.parent;
    uriToAppend = node.uri;
  }

  return {
    ...state,
    editedWorkingSet: Selectors.getEditedWorkingSet(state).append(uriToAppend),
  };
}

function uncheckNode(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  if (!Selectors.getIsEditingWorkingSet(state)) {
    return state;
  }

  let node = Selectors.getNode(state, rootKey, nodeKey);
  if (node == null) {
    return state;
  }

  const nodesToAppend = [];
  let uriToRemove = nodeKey;

  while (
    node.parent != null &&
    Selectors.getNodeCheckedStatus(state)(node.parent) === 'checked'
  ) {
    const parent = node.parent; // Workaround flow's (over)aggressive nullability detection
    parent.children.forEach(c => {
      if (c !== node) {
        nodesToAppend.push(c);
      }
    });

    node = parent;
    uriToRemove = node.uri;
  }

  const urisToAppend = nodesToAppend.map(n => n.uri);
  return {
    ...state,
    editedWorkingSet: Selectors.getEditedWorkingSet(state)
      .remove(uriToRemove)
      .append(...urisToAppend),
  };
}

function setDragHoveredNode(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  const nextState = clearDragHover(state);
  return setRoots(
    nextState,
    updateNodeAtRoot(state._roots, rootKey, nodeKey, node =>
      node.setIsDragHovered(true),
    ),
  );
}

function unhoverNode(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  return setRoots(
    state,
    updateNodeAtRoot(state._roots, rootKey, nodeKey, node =>
      node.setIsDragHovered(false),
    ),
  );
}

/**
 * Selects a single node and tracks it.
 */
function setSelectedNode(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  let nextState = clearSelection(state);
  nextState = setTrackedNode(nextState, rootKey, nodeKey);
  return addSelectedNode(nextState, rootKey, nodeKey);
}

function setSelectionRange(
  state: AppState,
  selectionRange: SelectionRange,
): AppState {
  return {
    ...state,
    _selectionRange: selectionRange,
    _targetNodeKeys: null,
  };
}

/**
 * Mark a node that has been focused, similar to selected, but only true after mouseup.
 */
function setFocusedNode(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  const node = Selectors.getNode(state, rootKey, nodeKey);
  if (node == null) {
    return state;
  }
  return {
    ...state,
    _focusedUris: addNodes(state._focusedUris, [node]),
  };
}

function addSelectedNode(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  const node = Selectors.getNode(state, rootKey, nodeKey);
  if (node == null) {
    return state;
  }
  const nextState = {
    ...state,
    _selectedUris: addNodes(state._selectedUris, [node]),
  };
  return setSelectionRange(
    nextState,
    SelectionRange.ofSingleItem(new RangeKey(rootKey, nodeKey)),
  );
}

function unselectNode(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  const node = Selectors.getNode(state, rootKey, nodeKey);
  if (node == null) {
    return state;
  }
  return {
    ...state,
    _selectedUris: deleteNodes(state._selectedUris, [node]),
    _focusedUris: deleteNodes(state._focusedUris, [node]),
  };
}

/**
 * Moves the selection one node up. In case several nodes were selected, the topmost (first in
 * the natural visual order) is considered to be the reference point for the move.
 */
function moveSelectionUp(state: AppState): AppState {
  if (state._roots.isEmpty()) {
    return state;
  }

  const selectedNodes = Selectors.getSelectedNodes(state);

  let nodeToSelect;
  if (selectedNodes.isEmpty()) {
    nodeToSelect = Selectors.findLastRecursiveChild(state)(
      nullthrows(state._roots.last()),
    );
  } else {
    const selectedNode = nullthrows(selectedNodes.first());
    nodeToSelect = Selectors.findPrevious(state)(selectedNode);
  }

  while (nodeToSelect != null && !nodeToSelect.matchesFilter) {
    nodeToSelect = Selectors.findPrevious(state)(nodeToSelect);
  }

  if (nodeToSelect == null) {
    return state;
  }

  return setSelectedAndFocusedNode(
    state,
    nodeToSelect.rootUri,
    nodeToSelect.uri,
  );
}

/**
 * Selects and focuses a node in one pass.
 */
function setSelectedAndFocusedNode(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  const node = Selectors.getNode(state, rootKey, nodeKey);
  let nextState = clearSelection(state);
  if (node != null) {
    nextState = {
      ...nextState,
      _selectedUris: addNodes(nextState._selectedUris, [node]),
      _focusedUris: addNodes(nextState._focusedUris, [node]),
    };
  }
  nextState = setTrackedNode(nextState, rootKey, nodeKey);
  return setSelectionRange(
    nextState,
    SelectionRange.ofSingleItem(new RangeKey(rootKey, nodeKey)),
  );
}

/**
 * Bulk selection based on the range.
 */
function rangeSelectToNode(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  const getShownChildrenCount = Selectors.getShownChildrenCount(state);
  const {updatedState, data} = refreshSelectionRange(state);
  let nextState = updatedState;
  if (data == null) {
    return nextState;
  }
  const {selectionRange, anchorIndex, rangeIndex} = data;

  let nextRangeNode = Selectors.getNode(nextState, rootKey, nodeKey);
  if (nextRangeNode == null) {
    return nextState;
  }
  const nextRangeIndex = Selectors.getVisualIndex(state)(nextRangeNode);
  if (nextRangeIndex === rangeIndex) {
    return nextState;
  }

  const modMinIndex = Math.min(anchorIndex, rangeIndex, nextRangeIndex);
  const modMaxIndex = Math.max(anchorIndex, rangeIndex, nextRangeIndex);

  let beginIndex = 1;

  const nodesToUnselect = new Set();
  const nodesToSelect = new Set();

  // Traverse the tree, determining which nodes to select/focus and unselect/unfocus.
  // TODO: We're no longer actually setting anything in the tree here, just walking it. So don't
  // use `setRecursive()`
  nextState._roots.forEach(
    (rootNode: FileTreeNode): FileTreeNode =>
      rootNode.setRecursive(
        // keep traversing the sub-tree,
        // - if the node is shown, has children, and in the applicable range.
        (node: FileTreeNode): ?FileTreeNode => {
          if (!Selectors.getNodeShouldBeShown(state)(node)) {
            return node;
          }
          if (getShownChildrenCount(node) === 1) {
            beginIndex++;
            return node;
          }
          const endIndex = beginIndex + getShownChildrenCount(node) - 1;
          if (beginIndex <= modMaxIndex && modMinIndex <= endIndex) {
            beginIndex++;
            return null;
          }
          beginIndex += getShownChildrenCount(node);
          return node;
        },
        // flip the isSelected flag accordingly, based on previous and current range.
        (node: FileTreeNode): FileTreeNode => {
          if (!Selectors.getNodeShouldBeShown(state)(node)) {
            return node;
          }
          const curIndex = beginIndex - getShownChildrenCount(node);
          const inOldRange =
            Math.sign(curIndex - anchorIndex) *
              Math.sign(curIndex - rangeIndex) !==
            1;
          const inNewRange =
            Math.sign(curIndex - anchorIndex) *
              Math.sign(curIndex - nextRangeIndex) !==
            1;
          if ((inOldRange && inNewRange) || (!inOldRange && !inNewRange)) {
            return node;
          } else if (inOldRange && !inNewRange) {
            nodesToUnselect.add(node);
          } else {
            nodesToSelect.add(node);
          }
          return node;
        },
      ),
  );
  nextState = {
    ...nextState,
    _selectedUris: deleteNodes(
      addNodes(nextState._selectedUris, nodesToSelect),
      nodesToUnselect,
    ),
    _focusedUris: deleteNodes(
      addNodes(nextState._focusedUris, nodesToSelect),
      nodesToUnselect,
    ),
  };

  // expand the range to merge existing selected nodes.
  const getNextNode = (cur: FileTreeNode) =>
    nextRangeIndex < rangeIndex
      ? Selectors.findPrevious(state)(cur)
      : Selectors.findNext(state)(cur);
  let probe = getNextNode(nextRangeNode);
  while (probe != null && Selectors.getNodeIsSelected(nextState)(probe)) {
    nextRangeNode = probe;
    probe = getNextNode(nextRangeNode);
  }
  return setSelectionRange(
    nextState,
    selectionRange.withNewRange(RangeKey.of(nextRangeNode)),
  );
}

type RefreshSelectionRangeResult = {
  updatedState: AppState,
  data: ?{
    selectionRange: SelectionRange,
    anchorNode: FileTreeNode,
    rangeNode: FileTreeNode,
    anchorIndex: number,
    rangeIndex: number,
    direction: 'up' | 'down' | 'none',
  },
};

/**
 * Refresh the selection range data.
 * invalidate the data
 * - if anchor node or range node is deleted.
 * - if these two nodes are not selected, and there is no nearby node to fall back to.
 * When this function returns, the selection range always contains valid data.
 */
function refreshSelectionRange(state: AppState): RefreshSelectionRangeResult {
  const invalidate = () => ({
    updatedState: clearSelectionRange(state),
    data: null,
  });

  let selectionRange = state._selectionRange;
  if (selectionRange == null) {
    return invalidate();
  }
  const anchor = selectionRange.anchor();
  const range = selectionRange.range();
  let anchorNode = Selectors.getNode(state, anchor.rootKey(), anchor.nodeKey());
  let rangeNode = Selectors.getNode(state, range.rootKey(), range.nodeKey());
  if (anchorNode == null || rangeNode == null) {
    return invalidate();
  }

  anchorNode = Selectors.getNearbySelectedNode(state, anchorNode);
  rangeNode = Selectors.getNearbySelectedNode(state, rangeNode);
  if (anchorNode == null || rangeNode == null) {
    return invalidate();
  }
  const anchorIndex = Selectors.getVisualIndex(state)(anchorNode);
  const rangeIndex = Selectors.getVisualIndex(state)(rangeNode);
  const direction =
    rangeIndex > anchorIndex
      ? 'down'
      : rangeIndex === anchorIndex
        ? 'none'
        : 'up';

  selectionRange = new SelectionRange(
    RangeKey.of(anchorNode),
    RangeKey.of(rangeNode),
  );
  return {
    updatedState: setSelectionRange(state, selectionRange),
    data: {
      selectionRange,
      anchorNode,
      rangeNode,
      anchorIndex,
      rangeIndex,
      direction,
    },
  };
}

/**
 * Move the range of selections by one step.
 */
function rangeSelectMove(state: AppState, move: 'up' | 'down'): AppState {
  const refreshSelectionRangeResult = refreshSelectionRange(state);
  const {data} = refreshSelectionRangeResult;
  let nextState = refreshSelectionRangeResult.updatedState;
  if (data == null) {
    return nextState;
  }
  const {selectionRange, anchorNode, rangeNode, direction} = data;
  const getNextNode = (cur: FileTreeNode) =>
    move === 'up'
      ? Selectors.findPrevious(state)(cur)
      : Selectors.findNext(state)(cur);

  const isExpanding = direction === move || direction === 'none';

  if (isExpanding) {
    let nextNode = getNextNode(rangeNode);
    while (nextNode != null && Selectors.getNodeIsSelected(state)(nextNode)) {
      nextNode = getNextNode(nextNode);
    }
    if (nextNode == null) {
      return nextState;
    }
    nextState = {
      ...nextState,
      _selectedUris: addNodes(nextState._selectedUris, [nextNode]),
      _focusedUris: addNodes(nextState._focusedUris, [nextNode]),
    };
    let probe = getNextNode(nextNode);
    while (probe != null && Selectors.getNodeIsSelected(nextState)(probe)) {
      nextNode = probe;
      probe = getNextNode(nextNode);
    }
    nextState = setSelectionRange(
      nextState,
      selectionRange.withNewRange(RangeKey.of(nextNode)),
    );
    nextState = setTrackedNode(nextState, nextNode.rootUri, nextNode.uri);
  } else {
    let nextNode = rangeNode;
    while (
      nextNode != null &&
      nextNode !== anchorNode &&
      Selectors.getNodeIsSelected(nextState)(nextNode) === false
    ) {
      nextNode = getNextNode(nextNode);
    }
    if (nextNode == null) {
      return nextState;
    }
    if (nextNode === anchorNode) {
      nextState = setSelectionRange(
        nextState,
        selectionRange.withNewRange(RangeKey.of(nextNode)),
      );
      return nextState;
    }
    nextState = {
      ...nextState,
      _selectedUris: deleteNodes(nextState._selectedUris, [nextNode]),
      _focusedUris: deleteNodes(nextState._focusedUris, [nextNode]),
    };
    nextState = setSelectionRange(
      nextState,
      selectionRange.withNewRange(RangeKey.of(nextNode)),
    );
    nextState = setTrackedNode(nextState, nextNode.rootUri, nextNode.uri);
  }

  return nextState;
}

/**
 * Moves the selection one node down. In case several nodes were selected, the topmost (first in
 * the natural visual order) is considered to be the reference point for the move.
 */
function moveSelectionDown(state: AppState): AppState {
  if (state._roots.isEmpty()) {
    return state;
  }

  const selectedNodes = Selectors.getSelectedNodes(state);

  let nodeToSelect;
  if (selectedNodes.isEmpty()) {
    nodeToSelect = state._roots.first();
  } else {
    const selectedNode = nullthrows(selectedNodes.first());
    nodeToSelect = Selectors.findNext(state)(selectedNode);
  }

  while (nodeToSelect != null && !nodeToSelect.matchesFilter) {
    nodeToSelect = Selectors.findNext(state)(nodeToSelect);
  }

  if (nodeToSelect == null) {
    return state;
  }

  return setSelectedAndFocusedNode(
    state,
    nodeToSelect.rootUri,
    nodeToSelect.uri,
  );
}

function moveSelectionToTop(state: AppState): AppState {
  if (state._roots.isEmpty()) {
    return state;
  }

  let nodeToSelect = state._roots.first();
  if (
    nodeToSelect != null &&
    !Selectors.getNodeShouldBeShown(state)(nodeToSelect)
  ) {
    nodeToSelect = Selectors.findNext(state)(nodeToSelect);
  }

  if (nodeToSelect == null) {
    return state;
  }

  return setSelectedAndFocusedNode(state, nodeToSelect.uri, nodeToSelect.uri);
}

function moveSelectionToBottom(state: AppState): AppState {
  if (state._roots.isEmpty()) {
    return state;
  }

  const lastRoot = state._roots.last();
  invariant(lastRoot != null);
  const lastChild = Selectors.findLastRecursiveChild(state)(lastRoot);
  invariant(lastChild != null);
  return setSelectedAndFocusedNode(state, lastChild.rootUri, lastChild.uri);
}

function clearFilter(state: AppState): AppState {
  const nextState = {...state, _filter: ''};
  return updateRoots(nextState, root => {
    return root.setRecursive(
      node => null,
      node => node.set({highlightedText: '', matchesFilter: true}),
    );
  });
}

function addExtraProjectSelectionContent(
  state: AppState,
  content: React.Element<any>,
): AppState {
  return {
    ...state,
    _extraProjectSelectionContent: state._extraProjectSelectionContent.push(
      content,
    ),
  };
}

function removeExtraProjectSelectionContent(
  state: AppState,
  content: React.Element<any>,
): AppState {
  const index = state._extraProjectSelectionContent.indexOf(content);
  if (index === -1) {
    return state;
  }
  return {
    ...state,
    _extraProjectSelectionContent: state._extraProjectSelectionContent.remove(
      index,
    ),
  };
}

function setOpenFilesExpanded(
  state: AppState,
  openFilesExpanded: boolean,
): AppState {
  return {
    ...state,
    _openFilesExpanded: openFilesExpanded,
  };
}

function setUncommittedChangesExpanded(
  state: AppState,
  uncommittedChangesExpanded: boolean,
): AppState {
  return {
    ...state,
    _uncommittedChangesExpanded: uncommittedChangesExpanded,
  };
}

function setFoldersExpanded(
  state: AppState,
  foldersExpanded: boolean,
): AppState {
  return {
    ...state,
    _foldersExpanded: foldersExpanded,
  };
}

/*
 * Manually sets a target node used for context menu actions. The value can be
 * retrieved by calling `getTargetNodes` or `getSingleTargetNode` both of
 * which will retrieve the target node if it exists and default to selected
 * nodes otherwise.
 * This value gets cleared everytime a selection is set
 */
function setTargetNode(
  state: AppState,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): AppState {
  return {
    ...state,
    _targetNodeKeys: {rootKey, nodeKey},
  };
}

function addFilterLetter(state: AppState, letter: string): AppState {
  const getNodeContainsFilterMatches = Selectors.getNodeContainsFilterMatches(
    state,
  );
  let nextState = {...state};
  nextState._filter = state._filter + letter;
  nextState = updateRoots(nextState, root => {
    return root.setRecursive(
      node => (getNodeContainsFilterMatches(node) ? null : node),
      node => {
        return matchesFilter(node.name, nextState._filter)
          ? node.set({
              highlightedText: nextState._filter,
              matchesFilter: true,
            })
          : node.set({highlightedText: '', matchesFilter: false});
      },
    );
  });
  nextState = selectFirstFilter(nextState);
  return nextState;
}

function selectFirstFilter(state: AppState): AppState {
  let node = Selectors.getSingleSelectedNode(state);
  // if the current node matches the filter do nothing
  if (node != null && node.matchesFilter) {
    return state;
  }

  let nextState = moveSelectionDown(state);
  node = Selectors.getSingleSelectedNode(nextState);
  // if the selection does not find anything up go down
  if (node != null && !node.matchesFilter) {
    nextState = moveSelectionUp(nextState);
  }
  return nextState;
}

function removeFilterLetter(state: AppState): AppState {
  const oldLength = state._filter.length;
  let nextState = {...state};
  nextState._filter = nextState._filter.substr(0, nextState._filter.length - 1);
  if (oldLength > 1) {
    nextState = updateRoots(nextState, root => {
      return root.setRecursive(
        node => null,
        node => {
          return matchesFilter(node.name, nextState._filter)
            ? node.set({
                highlightedText: nextState._filter,
                matchesFilter: true,
              })
            : node.set({highlightedText: '', matchesFilter: false});
        },
      );
    });
  } else if (oldLength === 1) {
    nextState = clearFilter(nextState);
  }
  return nextState;
}

function addNodes(
  map_: Immutable.Map<NuclideUri, Immutable.Set<NuclideUri>>,
  nodes: Iterable<FileTreeNode>,
): Immutable.Map<NuclideUri, Immutable.Set<NuclideUri>> {
  let map = map_;
  for (const node of nodes) {
    map = map.updateIn([node.rootUri], (set = Immutable.Set()) =>
      set.add(node.uri),
    );
  }
  return map;
}

function deleteNodes(
  map_: Immutable.Map<NuclideUri, Immutable.Set<NuclideUri>>,
  nodes: Iterable<FileTreeNode>,
): Immutable.Map<NuclideUri, Immutable.Set<NuclideUri>> {
  let map = map_;
  for (const node of nodes) {
    map = map.updateIn([node.rootUri], (set = Immutable.Set()) =>
      set.delete(node.uri),
    );
    const set = map.get(node.rootUri);
    if (set != null && set.size === 0) {
      map = map.delete(node.rootUri);
    }
  }
  return map;
}

function setNodeIsBeingReordered(
  node: FileTreeNode,
  isBeingReordered: boolean,
  getNodeShouldBeShown: FileTreeNode => boolean,
): FileTreeNode {
  return node.setRecursive(
    n => (getNodeShouldBeShown(n) ? null : n),
    n => (getNodeShouldBeShown(n) ? n.set({isBeingReordered}) : n),
  );
}
