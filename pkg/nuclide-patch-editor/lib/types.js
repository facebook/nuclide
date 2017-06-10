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

import typeof * as BoundActionCreators from './redux/Actions';

export type AppState = {
  // Mapped by editorPath
  patchEditors: Map<string, PatchData>,
};

export type PatchData = {
  // Mapped by changed fileName
  files: Map<string, FileData>,
};

export type FileData = {
  // Map from Hunk's oldStart line number to hunk
  chunks: ?Map<number, HunkData>,
  countEnabledChunks: number,
  countPartialChunks: number,
  fileDiff: diffparser$FileDiff,
  id: string, // equal to `${this.fileDiff.to}:${this.fileDiff.from}`
  selected: SelectedState,
};

export type HunkData = {
  // All changes within a hunk are contiguous, so we can use an array
  allChanges: Array<boolean>,
  countEnabledChanges: number,
  // Index into the hunk at which the first '+' or '-' line appears
  firstChangedLineIndex: number,
  selected: SelectedState,
};

export type SelectedState = 'all' | 'some' | 'none';

export type ExtraFileChangesData = {
  actionCreators: BoundActionCreators,
  fileData: FileData,
  patchId: string,
};

export type Store = {
  getState(): AppState,
  dispatch(action: Action): void,
};

export type RegisterPatchEditorAction = {
  type: 'REGISTER_PATCH_EDITOR',
  payload: {
    editorPath: string,
    patchData: Array<diffparser$FileDiff>,
  },
};

export type DeregisterPatchEditorAction = {
  type: 'DEREGISTER_PATCH_EDITOR',
  payload: {
    editorPath: string,
  },
};

export type ToggleFileAction = {
  type: 'TOGGLE_FILE_ACTION',
  payload: {
    patchId: string,
    fileId: string,
  },
};

export type ToggleHunkAction = {
  type: 'TOGGLE_HUNK_ACTION',
  payload: {
    patchId: string,
    fileId: string,
    hunkOldStart: number,
  },
};

export type ToggleLineAction = {
  type: 'TOGGLE_LINE_ACTION',
  payload: {
    patchId: string,
    fileId: string,
    hunkOldStart: number,
    line: number,
  },
};

export type Action =
  | RegisterPatchEditorAction
  | DeregisterPatchEditorAction
  | ToggleFileAction
  | ToggleHunkAction
  | ToggleLineAction;
