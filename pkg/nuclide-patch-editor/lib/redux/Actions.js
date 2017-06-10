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
  DeregisterPatchEditorAction,
  RegisterPatchEditorAction,
  ToggleFileAction,
  ToggleHunkAction,
  ToggleLineAction,
} from '../types';

import * as ActionTypes from './ActionTypes';

export function registerPatchEditor(
  editorPath: string,
  patchData: Array<diffparser$FileDiff>,
): RegisterPatchEditorAction {
  return {
    type: ActionTypes.REGISTER_PATCH_EDITOR,
    payload: {
      editorPath,
      patchData,
    },
  };
}

export function deregisterPatchEditor(
  editorPath: string,
): DeregisterPatchEditorAction {
  return {
    type: ActionTypes.DEREGISTER_PATCH_EDITOR,
    payload: {
      editorPath,
    },
  };
}

export function toggleFile(patchId: string, fileId: string): ToggleFileAction {
  return {
    type: ActionTypes.TOGGLE_FILE_ACTION,
    payload: {
      patchId,
      fileId,
    },
  };
}

export function toggleHunk(
  patchId: string,
  fileId: string,
  hunkOldStart: number,
): ToggleHunkAction {
  return {
    type: ActionTypes.TOGGLE_HUNK_ACTION,
    payload: {
      patchId,
      fileId,
      hunkOldStart,
    },
  };
}

export function toggleLine(
  patchId: string,
  fileId: string,
  hunkOldStart: number,
  line: number,
): ToggleLineAction {
  return {
    type: ActionTypes.TOGGLE_LINE_ACTION,
    payload: {
      patchId,
      fileId,
      hunkOldStart,
      line,
    },
  };
}
