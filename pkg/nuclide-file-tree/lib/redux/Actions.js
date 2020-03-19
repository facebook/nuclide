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
// eslint-disable-next-line nuclide-internal/import-type-style
import type {RemoteTransferService} from '../../../nuclide-remote-transfer';
import type {Action} from '../types';
import type {FileTreeNode} from '../FileTreeNode';
import type CwdApi from '../../../nuclide-current-working-directory/lib/CwdApi';
import type {
  StatusCodeNumberValue,
  RevisionInfo,
} from '../../../nuclide-hg-rpc/lib/types';
import type {RemoteProjectsService} from '../../../nuclide-remote-projects';
import type {WorkingSet} from '../../../nuclide-working-sets-common';
import type {WorkingSetsStore} from '../../../nuclide-working-sets/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {InitialData, ExportStoreData, Roots} from '../types';
import type {GeneratedFileType} from '../../../nuclide-generated-files-rpc';

import * as Immutable from 'immutable';

export const CLEAR_DRAG_HOVER = 'CLEAR_DRAG_HOVER';
export const CLEAR_LOADING = 'CLEAR_LOADING';
export const CLEAR_SELECTION = 'CLEAR_SELECTION';
export const CLEAR_SELECTION_RANGE = 'CLEAR_SELECTION_RANGE';
export const COLLAPSE_NODE = 'COLLAPSE_NODE';
export const COLLAPSE_NODE_DEEP = 'COLLAPSE_NODE_DEEP';
export const COLLAPSE_SELECTION = 'COLLAPSE_SELECTION';
export const COLLAPSE_ALL = 'COLLAPSE_ALL';
export const CONFIRM_NODE = 'CONFIRM_NODE';
export const COPY_FILENAMES_WITH_DIR = 'COPY_FILENAMES_WITH_DIR';
export const DELETE_SELECTED_NODES = 'DELETE_SELECTED_NODES';
export const DELETE_SELECTION = 'DELETE_SELECTION';
export const EXPAND_NODE = 'EXPAND_NODE';
export const EXPAND_SELECTION = 'EXPAND_SELECTION';
export const LOAD_DATA = 'LOAD_DATA';
export const SET_EXCLUDE_VCS_IGNORED_PATHS = 'SET_EXCLUDE_VCS_IGNORED_PATHS';
export const EXPAND_NODE_DEEP = 'EXPAND_NODE_DEEP';
export const SET_CWD = 'SET_CWD';
export const SET_CWD_TO_SELECTION = 'SET_CWD_TO_SELECTION';
export const SET_CWD_API = 'SET_CWD_API';
export const SET_HIDE_IGNORED_NAMES = 'SET_HIDE_IGNORED_NAMES';
export const SET_HIDE_VCS_IGNORED_PATHS = 'SET_HIDE_VCS_IGNORED_PATHS';
export const SET_IS_CALCULATING_CHANGES = 'SET_IS_CALCULATING_CHANGES';
export const SET_IGNORED_NAMES = 'SET_IGNORED_NAMES';
export const SET_LOADING = 'SET_LOADING';
export const SET_ROOTS = 'SET_ROOTS';
export const SET_TRACKED_NODE = 'SET_TRACKED_NODE';
export const SET_REMOTE_PROJECTS_SERVICE = 'SET_REMOTE_PROJECTS_SERVICE';
export const CLEAR_TRACKED_NODE = 'CLEAR_TRACKED_NODE';
export const CLEAR_TRACKED_NODE_IF_NOT_LOADING =
  'CLEAR_TRACKED_NODE_IF_NOT_LOADING';
export const KEEP_PREVIEW_TAB = 'KEEP_PREVIEW_TAB';
export const OPEN_SELECTED_ENTRY = 'OPEN_SELECTED_ENTRY';
export const OPEN_SELECTED_ENTRY_SPLIT = 'OPEN_SELECTED_ENTRY_SPLIT';
export const OPEN_ENTRY_SPLIT = 'OPEN_ENTRY_SPLIT';
export const OPEN_ADD_FOLDER_DIALOG = 'OPEN_ADD_FOLDER_DIALOG';
export const OPEN_ADD_FILE_DIALOG = 'OPEN_ADD_FILE_DIALOG';
export const OPEN_ADD_FILE_DIALOG_RELATIVE = 'OPEN_ADD_FILE_DIALOG_RELATIVE';
export const OPEN_RENAME_DIALOG = 'OPEN_RENAME_DIALOG';
export const OPEN_DUPLICATE_DIALOG = 'OPEN_DUPLICATE_DIALOG';
export const OPEN_NEXT_DUPLICATE_DIALOG = 'OPEN_NEXT_DUPLICATE_DIALOG';
export const OPEN_PASTE_DIALOG = 'OPEN_PASTE_DIALOG';
export const START_REORDER_DRAG = 'START_REORDER_DRAG';
export const END_REORDER_DRAG = 'END_REORDER_DRAG';
export const REVEAL_NODE_KEY = 'REVEAL_NODE_KEY';
export const REVEAL_FILE_PATH = 'REVEAL_FILE_PATH';
export const OPEN_AND_REVEAL_FILE_PATH = 'OPEN_AND_REVEAL_FILE_PATH';
export const OPEN_AND_REVEAL_FILE_PATHS = 'OPEN_AND_REVEAL_FILE_PATHS';
export const OPEN_AND_REVEAL_DIRECTORY_PATH = 'OPEN_AND_REVEAL_DIRECTORY_PATH';
export const REORDER_DRAG_INTO = 'REORDER_DRAG_INTO';
export const REORDER_ROOTS = 'REORDER_ROOTS';
export const MOVE_TO_NODE = 'MOVE_TO_NODE';
export const MOVE_PATH_TO_NODE = 'MOVE_PATH_TO_NODE';
export const SET_INITIAL_DATA = 'SET_INITIAL_DATA';
export const SET_USE_PREVIEW_TABS = 'SET_USE_PREVIEW_TABS';
export const SET_USE_PREFIX_NAV = 'SET_USE_PREFIX_NAV';
export const SET_AUTO_EXPAND_SINGLE_CHILD = 'SET_AUTO_EXPAND_SINGLE_CHILD';
export const SET_FOCUS_EDITOR_ON_FILE_SELECTION =
  'SET_FOCUS_EDITOR_ON_FILE_SELECTION';
export const SET_VCS_STATUSES = 'SET_VCS_STATUSES';
export const SET_REPOSITORIES = 'SET_REPOSITORIES';
export const SET_WORKING_SET = 'SET_WORKING_SET';
export const WORKING_SET_CHANGE_REQUESTED = 'WORKING_SET_CHANGE_REQUESTED';
export const SET_OPEN_FILES_WORKING_SET = 'SET_OPEN_FILES_WORKING_SET';
export const SET_WORKING_SETS_STORE = 'SET_WORKING_SETS_STORE';
export const START_EDITING_WORKING_SET = 'START_EDITING_WORKING_SET';
export const FINISH_EDITING_WORKING_SET = 'FINISH_EDITING_WORKING_SET';
export const CHECK_NODE = 'CHECK_NODE';
export const UNCHECK_NODE = 'UNCHECK_NODE';
export const SET_DRAG_HOVERED_NODE = 'SET_DRAG_HOVERED_NODE';
export const UNHOVER_NODE = 'UNHOVER_NODE';
export const SET_SELECTED_NODE = 'SET_SELECTED_NODE';
export const SET_FOCUSED_NODE = 'SET_FOCUSED_NODE';
export const ADD_SELECTED_NODE = 'ADD_SELECTED_NODE';
export const UNSELECT_NODE = 'UNSELECT_NODE';
export const RANGE_SELECT_TO_NODE = 'RANGE_SELECT_TO_NODE';
export const RANGE_SELECT_UP = 'RANGE_SELECT_UP';
export const RANGE_SELECT_DOWN = 'RANGE_SELECT_DOWN';
export const MOVE_SELECTION_UP = 'MOVE_SELECTION_UP';
export const MOVE_SELECTION_DOWN = 'MOVE_SELECTION_DOWN';
export const MOVE_SELECTION_TO_TOP = 'MOVE_SELECTION_TO_TOP';
export const MOVE_SELECTION_TO_BOTTOM = 'MOVE_SELECTION_TO_BOTTOM';
export const CLEAR_FILTER = 'CLEAR_FILTER';
export const ADD_EXTRA_PROJECT_SELECTION_CONTENT =
  'ADD_EXTRA_PROJECT_SELECTION_CONTENT';
export const REMOVE_EXTRA_PROJECT_SELECTION_CONTENT =
  'REMOVE_EXTRA_PROJECT_SELECTION_CONTENT';
export const REMOVE_ROOT_FOLDER_SELECTION = 'REMOVE_ROOT_FOLDER_SELECTION';
export const SET_OPEN_FILES_EXPANDED = 'SET_OPEN_FILES_EXPANDED';
export const SET_UNCOMMITTED_CHANGES_EXPANDED =
  'SET_UNCOMMITTED_CHANGES_EXPANDED';
export const SET_FOLDERS_EXPANDED = 'SET_FOLDERS_EXPANDED';
export const SET_TARGET_NODE = 'SET_TARGET_NODE';
export const UPDATE_GENERATED_STATUSES = 'UPDATE_GENERATED_STATUSES';
export const ADD_FILTER_LETTER = 'ADD_FILTER_LETTER';
export const REMOVE_FILTER_LETTER = 'REMOVE_FILTER_LETTER';
export const UPDATE_REPOSITORIES = 'UPDATE_REPOSITORIES';
export const UPDATE_ROOT_DIRECTORIES = 'UPDATE_ROOT_DIRECTORIES';
export const GOT_REMOTE_TRANSFER_SERVICE = 'GOT_REMOTE_TRANSFER_SERVICE';
export const UPLOAD_DROPPED_FILES = 'UPLOAD_DROPPED_FILES';

export const SELECT = 'SELECTION:SELECT';
export const UNSELECT = 'SELECTION:UNSELECT';
export const FOCUS = 'SELECTION:FOCUS';
export const UNFOCUS = 'SELECTION:UNFOCUS';
export const CLEAR_SELECTED = 'SELECTION:CLEAR_SELECTED';
export const CLEAR_FOCUSED = 'SELECTION:CLEAR_FOCUSED';
export const CHANGE_WORKING_REVISION = 'CHANGE_WORKING_REVISION';

export function setCwd(rootKey: ?string): Action {
  return {
    type: SET_CWD,
    rootKey,
  };
}

export function clearFilter(): Action {
  return {
    type: CLEAR_FILTER,
  };
}

export function addExtraProjectSelectionContent(
  content: React.Element<any>,
): Action {
  return {
    type: ADD_EXTRA_PROJECT_SELECTION_CONTENT,
    content,
  };
}

export function removeExtraProjectSelectionContent(
  content: React.Element<any>,
): Action {
  return {
    type: REMOVE_EXTRA_PROJECT_SELECTION_CONTENT,
    content,
  };
}

export function expandNode(rootKey: string, nodeKey: string): Action {
  return {
    type: EXPAND_NODE,
    rootKey,
    nodeKey,
  };
}

export function expandNodeDeep(rootKey: string, nodeKey: string): Action {
  return {
    type: EXPAND_NODE_DEEP,
    rootKey,
    nodeKey,
  };
}

export function deleteSelectedNodes(): Action {
  return {type: DELETE_SELECTED_NODES};
}

export function collapseNode(rootKey: string, nodeKey: string): Action {
  return {
    type: COLLAPSE_NODE,
    rootKey,
    nodeKey,
  };
}

export function collapseNodeDeep(rootKey: string, nodeKey: string): Action {
  return {
    type: COLLAPSE_NODE_DEEP,
    rootKey,
    nodeKey,
  };
}

export function setExcludeVcsIgnoredPaths(
  excludeVcsIgnoredPaths: boolean,
): Action {
  return {
    type: SET_EXCLUDE_VCS_IGNORED_PATHS,
    excludeVcsIgnoredPaths,
  };
}

export function setHideVcsIgnoredPaths(hideVcsIgnoredPaths: boolean): Action {
  return {
    type: SET_HIDE_VCS_IGNORED_PATHS,
    hideVcsIgnoredPaths,
  };
}

export function setHideIgnoredNames(hideIgnoredNames: boolean): Action {
  return {
    type: SET_HIDE_IGNORED_NAMES,
    hideIgnoredNames,
  };
}

export function setIsCalculatingChanges(isCalculatingChanges: boolean): Action {
  return {
    type: SET_IS_CALCULATING_CHANGES,
    isCalculatingChanges,
  };
}

export function setIgnoredNames(ignoredNames: Array<string>): Action {
  return {
    type: SET_IGNORED_NAMES,
    ignoredNames,
  };
}

export function setTrackedNode(rootKey: string, nodeKey: string): Action {
  return {
    type: SET_TRACKED_NODE,
    nodeKey,
    rootKey,
  };
}

export function clearTrackedNode(): Action {
  return {
    type: CLEAR_TRACKED_NODE,
  };
}

export function clearTrackedNodeIfNotLoading(): Action {
  return {
    type: CLEAR_TRACKED_NODE_IF_NOT_LOADING,
  };
}

export function startReorderDrag(draggedRootKey: string): Action {
  return {
    type: START_REORDER_DRAG,
    draggedRootKey,
  };
}

export function endReorderDrag(): Action {
  return {
    type: END_REORDER_DRAG,
  };
}

export function reorderDragInto(dragTargetNodeKey: string): Action {
  return {
    type: REORDER_DRAG_INTO,
    dragTargetNodeKey,
  };
}

export function reorderRoots(): Action {
  return {
    type: REORDER_ROOTS,
  };
}

export function moveToNode(rootKey: string, nodeKey: string): Action {
  return {
    type: MOVE_TO_NODE,
    nodeKey,
    rootKey,
  };
}

export function movePathToNode(
  uri: NuclideUri,
  destination: FileTreeNode,
): Action {
  return {type: MOVE_PATH_TO_NODE, uri, destination};
}

export function setUsePreviewTabs(usePreviewTabs: boolean): Action {
  return {
    type: SET_USE_PREVIEW_TABS,
    usePreviewTabs,
  };
}

export function setFocusEditorOnFileSelection(
  focusEditorOnFileSelection: boolean,
): Action {
  return {
    type: SET_FOCUS_EDITOR_ON_FILE_SELECTION,
    focusEditorOnFileSelection,
  };
}

export function setUsePrefixNav(usePrefixNav: boolean): Action {
  return {
    type: SET_USE_PREFIX_NAV,
    usePrefixNav,
  };
}

export function setAutoExpandSingleChild(
  autoExpandSingleChild: boolean,
): Action {
  return {
    type: SET_AUTO_EXPAND_SINGLE_CHILD,
    autoExpandSingleChild,
  };
}

export function setVcsStatuses(
  rootKey: string,
  vcsStatuses: Map<NuclideUri, StatusCodeNumberValue>,
): Action {
  return {
    type: SET_VCS_STATUSES,
    rootKey,
    vcsStatuses,
  };
}

export function updateWorkingSet(workingSet: WorkingSet): Action {
  return {
    type: WORKING_SET_CHANGE_REQUESTED,
    workingSet,
  };
}

export function setWorkingSet(workingSet: WorkingSet): Action {
  return {
    type: SET_WORKING_SET,
    workingSet,
  };
}

export function updateOpenFilesWorkingSet(
  openFilesWorkingSet: WorkingSet,
): Action {
  return {
    type: SET_OPEN_FILES_WORKING_SET,
    openFilesWorkingSet,
  };
}

export function updateWorkingSetsStore(
  workingSetsStore: ?WorkingSetsStore,
): Action {
  return {
    type: SET_WORKING_SETS_STORE,
    workingSetsStore,
  };
}

export function startEditingWorkingSet(editedWorkingSet: WorkingSet): Action {
  return {
    type: START_EDITING_WORKING_SET,
    editedWorkingSet,
  };
}

export function finishEditingWorkingSet(): Action {
  return {
    type: FINISH_EDITING_WORKING_SET,
  };
}

export function checkNode(rootKey: string, nodeKey: string): Action {
  return {
    type: CHECK_NODE,
    rootKey,
    nodeKey,
  };
}

export function uncheckNode(rootKey: string, nodeKey: string): Action {
  return {
    type: UNCHECK_NODE,
    rootKey,
    nodeKey,
  };
}

export function setDragHoveredNode(rootKey: string, nodeKey: string): Action {
  return {
    type: SET_DRAG_HOVERED_NODE,
    rootKey,
    nodeKey,
  };
}

export function setSelectedNode(rootKey: string, nodeKey: string): Action {
  return {
    type: SET_SELECTED_NODE,
    rootKey,
    nodeKey,
  };
}

export function setFocusedNode(rootKey: string, nodeKey: string): Action {
  return {
    type: SET_FOCUSED_NODE,
    rootKey,
    nodeKey,
  };
}

export function addSelectedNode(rootKey: string, nodeKey: string): Action {
  return {
    type: ADD_SELECTED_NODE,
    rootKey,
    nodeKey,
  };
}

export function unselectNode(rootKey: string, nodeKey: string): Action {
  return {
    type: UNSELECT_NODE,
    rootKey,
    nodeKey,
  };
}

export function rangeSelectToNode(rootKey: string, nodeKey: string): Action {
  return {
    type: RANGE_SELECT_TO_NODE,
    rootKey,
    nodeKey,
  };
}

export function rangeSelectUp(): Action {
  return {
    type: RANGE_SELECT_UP,
  };
}

export function rangeSelectDown(): Action {
  return {
    type: RANGE_SELECT_DOWN,
  };
}

export function unhoverNode(rootKey: string, nodeKey: string): Action {
  return {
    type: UNHOVER_NODE,
    rootKey,
    nodeKey,
  };
}

export function moveSelectionUp(): Action {
  return {
    type: MOVE_SELECTION_UP,
  };
}

export function moveSelectionDown(): Action {
  return {
    type: MOVE_SELECTION_DOWN,
  };
}

export function moveSelectionToTop(): Action {
  return {
    type: MOVE_SELECTION_TO_TOP,
  };
}

export function moveSelectionToBottom(): Action {
  return {
    type: MOVE_SELECTION_TO_BOTTOM,
  };
}

export function setOpenFilesExpanded(openFilesExpanded: boolean): Action {
  return {
    type: SET_OPEN_FILES_EXPANDED,
    openFilesExpanded,
  };
}

export function setUncommittedChangesExpanded(
  uncommittedChangesExpanded: boolean,
): Action {
  return {
    type: SET_UNCOMMITTED_CHANGES_EXPANDED,
    uncommittedChangesExpanded,
  };
}

export function setFoldersExpanded(foldersExpanded: boolean): Action {
  return {
    type: SET_FOLDERS_EXPANDED,
    foldersExpanded,
  };
}

export function setTargetNode(
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
): Action {
  return {
    type: SET_TARGET_NODE,
    rootKey,
    nodeKey,
  };
}

export function updateGeneratedStatuses(
  generatedFileTypes: Map<NuclideUri, GeneratedFileType>,
): Action {
  return {
    type: UPDATE_GENERATED_STATUSES,
    generatedFileTypes,
  };
}

export function addFilterLetter(letter: string): Action {
  return {
    type: ADD_FILTER_LETTER,
    letter,
  };
}

export function removeFilterLetter(): Action {
  return {
    type: REMOVE_FILTER_LETTER,
  };
}

export function confirmNode(
  rootKey: string,
  nodeKey: string,
  pending: boolean = false,
): Action {
  return {
    type: CONFIRM_NODE,
    rootKey,
    nodeKey,
    pending,
  };
}

export function keepPreviewTab(): Action {
  return {type: KEEP_PREVIEW_TAB};
}

export function openEntrySplit(
  nodeKey: string,
  orientation: atom$PaneSplitOrientation,
  side: atom$PaneSplitSide,
): Action {
  return {
    type: OPEN_ENTRY_SPLIT,
    nodeKey,
    orientation,
    side,
  };
}

export function updateRepositories(
  rootDirectories: Array<atom$Directory>,
): Action {
  return {
    type: UPDATE_REPOSITORIES,
    rootDirectories,
  };
}

export function setRepositories(repositories: Immutable.Set<atom$Repository>) {
  return {
    type: SET_REPOSITORIES,
    repositories,
  };
}

export function revealNodeKey(nodeKey: ?string): Action {
  return {
    type: REVEAL_NODE_KEY,
    nodeKey,
  };
}

export function revealFilePath(
  filePath: ?string,
  showIfHidden?: boolean = true,
): Action {
  return {
    type: REVEAL_FILE_PATH,
    filePath,
    showIfHidden,
  };
}

export function openAndRevealFilePath(filePath: ?string): Action {
  return {
    type: OPEN_AND_REVEAL_FILE_PATH,
    filePath,
  };
}

export function openAndRevealFilePaths(filePaths: Array<string>): Action {
  return {
    type: OPEN_AND_REVEAL_FILE_PATHS,
    filePaths,
  };
}

export function openAndRevealDirectoryPath(path: ?string): Action {
  return {
    type: OPEN_AND_REVEAL_DIRECTORY_PATH,
    path,
  };
}

export function updateRootDirectories(): Action {
  return {
    type: UPDATE_ROOT_DIRECTORIES,
  };
}

export function setCwdToSelection(): Action {
  return {
    type: SET_CWD_TO_SELECTION,
  };
}

export function setCwdApi(cwdApi: ?CwdApi): Action {
  return {
    type: SET_CWD_API,
    cwdApi,
  };
}

export function setRemoteProjectsService(
  service: ?RemoteProjectsService,
): Action {
  return {
    type: SET_REMOTE_PROJECTS_SERVICE,
    service,
  };
}

export function collapseSelection(deep: boolean = false): Action {
  return {
    type: COLLAPSE_SELECTION,
    deep,
  };
}

export function selectAndTrackNode(node: FileTreeNode): Action {
  return setSelectedNode(node.rootUri, node.uri);
}

export function collapseAll(): Action {
  return {type: COLLAPSE_ALL};
}

export function deleteSelection(): Action {
  return {type: DELETE_SELECTION};
}

export function expandSelection(deep: boolean): Action {
  return {
    type: EXPAND_SELECTION,
    deep,
  };
}

export function openSelectedEntry(): Action {
  return {type: OPEN_SELECTED_ENTRY};
}

export function openSelectedEntrySplit(
  orientation: atom$PaneSplitOrientation,
  side: atom$PaneSplitSide,
): Action {
  return {
    type: OPEN_SELECTED_ENTRY_SPLIT,
    orientation,
    side,
  };
}

export function openSelectedEntrySplitUp(): Action {
  return openSelectedEntrySplit('vertical', 'before');
}

export function openSelectedEntrySplitDown(): Action {
  return openSelectedEntrySplit('vertical', 'after');
}

export function openSelectedEntrySplitLeft(): Action {
  return openSelectedEntrySplit('horizontal', 'before');
}

export function openSelectedEntrySplitRight(): Action {
  return openSelectedEntrySplit('horizontal', 'after');
}

export function removeRootFolderSelection(): Action {
  return {type: REMOVE_ROOT_FOLDER_SELECTION};
}

export function copyFilenamesWithDir(): Action {
  return {type: COPY_FILENAMES_WITH_DIR};
}

export function openAddFolderDialog(
  onDidConfirm: (filePath: ?string) => mixed,
): Action {
  return {
    type: OPEN_ADD_FOLDER_DIALOG,
    onDidConfirm,
  };
}

export function openAddFileDialog(
  onDidConfirm: (filePath: ?string) => mixed,
): Action {
  return {
    type: OPEN_ADD_FILE_DIALOG,
    onDidConfirm,
  };
}

export function openAddFileDialogRelative(
  onDidConfirm: (filePath: ?string) => mixed,
): Action {
  return {
    type: OPEN_ADD_FILE_DIALOG_RELATIVE,
    onDidConfirm,
  };
}

export function openRenameDialog(): Action {
  return {type: OPEN_RENAME_DIALOG};
}

export function openDuplicateDialog(
  onDidConfirm: (filePaths: Array<string>) => mixed,
): Action {
  return {
    type: OPEN_DUPLICATE_DIALOG,
    onDidConfirm,
  };
}

export function openNextDuplicateDialog(
  nodes: Immutable.List<FileTreeNode>,
  onDidConfirm: (filePaths: Array<string>) => mixed,
): Action {
  return {
    type: OPEN_NEXT_DUPLICATE_DIALOG,
    nodes,
    onDidConfirm,
  };
}

export function openPasteDialog(): Action {
  return {type: OPEN_PASTE_DIALOG};
}

export function clearSelection(): Action {
  return {type: CLEAR_SELECTION};
}

export function clearSelectionRange(): Action {
  return {type: CLEAR_SELECTION_RANGE};
}

export function clearDragHover(): Action {
  return {type: CLEAR_DRAG_HOVER};
}

export function setRoots(roots: Roots): Action {
  return {
    type: SET_ROOTS,
    roots,
  };
}

export function clearLoading(nodeKey: NuclideUri): Action {
  return {
    type: CLEAR_LOADING,
    nodeKey,
  };
}

export function setLoading(
  nodeKey: NuclideUri,
  promise: Promise<void>,
): Action {
  return {
    type: SET_LOADING,
    nodeKey,
    promise,
  };
}

export function loadData(data: ExportStoreData): Action {
  return {
    type: LOAD_DATA,
    data,
  };
}

export function setInitialData(data: InitialData): Action {
  return {
    type: SET_INITIAL_DATA,
    data,
  };
}

export function gotRemoteTransferService(
  remoteTransferService: ?RemoteTransferService,
): Action {
  return {type: GOT_REMOTE_TRANSFER_SERVICE, remoteTransferService};
}

export function uploadDroppedFiles(
  destination: FileTreeNode,
  files: FileList,
): Action {
  return {type: UPLOAD_DROPPED_FILES, destination, files};
}

export function select(node: FileTreeNode): Action {
  return {
    type: SELECT,
    node,
  };
}

export function unselect(node: FileTreeNode): Action {
  return {
    type: UNSELECT,
    node,
  };
}

export function focus(node: FileTreeNode): Action {
  return {
    type: FOCUS,
    node,
  };
}

export function unfocus(node: FileTreeNode): Action {
  return {
    type: UNFOCUS,
    node,
  };
}

export function clearSelected(): Action {
  return {type: CLEAR_SELECTED};
}

export function clearFocused(): Action {
  return {type: CLEAR_FOCUSED};
}

export function changeWorkingRevision(revision: ?RevisionInfo): Action {
  return {type: CHANGE_WORKING_REVISION, revision};
}
