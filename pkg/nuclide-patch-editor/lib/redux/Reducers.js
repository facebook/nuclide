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

import type {Action, AppState, FileData, HunkData, PatchData} from '../types';

import * as ActionTypes from './ActionTypes';
import {createEmptyAppState} from './createEmptyAppState';
import {createPatchData} from '../utils';
import invariant from 'invariant';
import nullthrows from 'nullthrows';
import {SelectedState} from '../constants';

export function rootReducer(state?: AppState, action: Action): AppState {
  if (state == null) {
    return createEmptyAppState();
  }
  switch (action.type) {
    case ActionTypes.REGISTER_PATCH_EDITOR: {
      const patchEditors = new Map(state.patchEditors);
      patchEditors.set(
        action.payload.editorPath,
        createPatchData(action.payload.patchData),
      );
      return {
        ...state,
        patchEditors,
      };
    }

    case ActionTypes.DEREGISTER_PATCH_EDITOR: {
      const patchEditors = new Map(state.patchEditors);
      patchEditors.delete(action.payload.editorPath);
      return {
        ...state,
        patchEditors,
      };
    }

    case ActionTypes.TOGGLE_FILE_ACTION: {
      const {patchId, fileId} = action.payload;

      const patchEditors = new Map(state.patchEditors);
      const patchData = nullthrows(patchEditors.get(patchId));
      patchEditors.set(patchId, updatePatchData(patchData, fileId));
      return {
        ...state,
        patchEditors,
      };
    }

    case ActionTypes.TOGGLE_HUNK_ACTION: {
      const {patchId, fileId, hunkOldStart} = action.payload;

      const patchEditors = new Map(state.patchEditors);
      const patchData = nullthrows(patchEditors.get(patchId));
      patchEditors.set(
        patchId,
        updatePatchData(patchData, fileId, hunkOldStart),
      );
      return {
        ...state,
        patchEditors,
      };
    }

    case ActionTypes.TOGGLE_LINE_ACTION: {
      const {patchId, fileId, hunkOldStart, line} = action.payload;

      const patchEditors = new Map(state.patchEditors);
      const patchData = nullthrows(patchEditors.get(patchId));
      patchEditors.set(
        patchId,
        updatePatchData(patchData, fileId, hunkOldStart, line),
      );
      return {
        ...state,
        patchEditors,
      };
    }
  }
  return state;
}

function updatePatchData(
  patchData: PatchData,
  fileId: string,
  hunkOldStart: ?number,
  line: ?number,
): PatchData {
  // line should never be non-null while hunkOldStart is
  invariant(line == null || hunkOldStart != null);

  const files = new Map(patchData.files);
  const oldFile = nullthrows(files.get(fileId));
  files.set(fileId, updateFileData(oldFile, hunkOldStart, line));

  return {
    ...patchData,
    files,
  };
}

function updateFileData(
  fileData: FileData,
  hunkOldStart: ?number,
  line: ?number,
): FileData {
  let {countEnabledChunks, countPartialChunks} = fileData;
  let chunks;
  let selected;

  if (hunkOldStart != null) {
    // Toggling hunk or individual line
    chunks = new Map(nullthrows(fileData.chunks));
    const oldHunk = nullthrows(chunks.get(hunkOldStart));
    const newHunk = updateHunkData(oldHunk, line);
    chunks.set(hunkOldStart, newHunk);

    // Update countEnabledChunks and countPartialChunks based on change in selected state
    invariant(
      !(
        oldHunk.selected === SelectedState.ALL &&
        newHunk.selected === SelectedState.ALL
      ) &&
        !(
          oldHunk.selected === SelectedState.NONE &&
          newHunk.selected === SelectedState.NONE
        ),
    );
    if (
      oldHunk.selected === SelectedState.ALL &&
      newHunk.selected === SelectedState.SOME
    ) {
      countEnabledChunks--;
      countPartialChunks++;
    } else if (
      oldHunk.selected === SelectedState.ALL &&
      newHunk.selected === SelectedState.NONE
    ) {
      countEnabledChunks--;
    } else if (
      oldHunk.selected === SelectedState.SOME &&
      newHunk.selected === SelectedState.ALL
    ) {
      countEnabledChunks++;
      countPartialChunks--;
    } else if (
      oldHunk.selected === SelectedState.SOME &&
      newHunk.selected === SelectedState.NONE
    ) {
      countPartialChunks--;
    } else if (
      oldHunk.selected === SelectedState.NONE &&
      newHunk.selected === SelectedState.ALL
    ) {
      countEnabledChunks++;
    } else if (
      oldHunk.selected === SelectedState.NONE &&
      newHunk.selected === SelectedState.SOME
    ) {
      countPartialChunks++;
    }

    if (countEnabledChunks + countPartialChunks === 0) {
      selected = SelectedState.NONE;
    } else if (countEnabledChunks === chunks.size) {
      invariant(countPartialChunks === 0);
      selected = SelectedState.ALL;
    } else {
      selected = SelectedState.SOME;
    }
  } else {
    // Toggling whole file
    let isEnabling;
    if (fileData.selected === SelectedState.NONE) {
      selected = SelectedState.ALL;
      isEnabling = true;
    } else {
      selected = SelectedState.NONE;
      isEnabling = false;
    }

    if (fileData.chunks != null) {
      // Set all hunks to all unselected
      chunks = new Map();
      fileData.chunks.forEach((hunkData, oldStart) =>
        chunks.set(oldStart, selectWholeHunk(hunkData, isEnabling)),
      );
      // TODO: update all children hunks to reflect change
      countEnabledChunks = isEnabling ? chunks.size : 0;
      countPartialChunks = 0;
      selected = isEnabling ? SelectedState.ALL : SelectedState.NONE;
    }
  }

  return {
    ...fileData,
    chunks,
    countEnabledChunks,
    countPartialChunks,
    selected,
  };
}

function updateHunkData(hunkData: HunkData, line: ?number): HunkData {
  let countEnabledChanges;
  let selected;
  const allChanges = hunkData.allChanges.slice();

  if (line != null) {
    // toggling a single line in a chunk
    allChanges[line] = !allChanges[line];
    if (allChanges[line]) {
      countEnabledChanges = hunkData.countEnabledChanges + 1;
    } else {
      countEnabledChanges = hunkData.countEnabledChanges - 1;
    }
    if (countEnabledChanges === allChanges.length) {
      selected = SelectedState.ALL;
    } else if (countEnabledChanges === 0) {
      selected = SelectedState.NONE;
    } else {
      selected = SelectedState.SOME;
    }
  } else {
    // toggling the entire chunk
    if (hunkData.selected === SelectedState.NONE) {
      selected = SelectedState.ALL;
      allChanges.fill(true);
      countEnabledChanges = allChanges.length;
    } else {
      selected = SelectedState.NONE;
      allChanges.fill(false);
      countEnabledChanges = 0;
    }
  }

  return {
    ...hunkData,
    allChanges,
    countEnabledChanges,
    selected,
  };
}

function selectWholeHunk(hunkData: HunkData, isEnabling: boolean): HunkData {
  if (
    (isEnabling && hunkData.selected === SelectedState.ALL) ||
    (!isEnabling && hunkData.selected === SelectedState.NONE)
  ) {
    return hunkData;
  }
  return {
    ...hunkData,
    countEnabledChanges: isEnabling ? hunkData.allChanges.length : 0,
    allChanges: hunkData.allChanges.slice().fill(isEnabling),
    selected: isEnabling ? SelectedState.ALL : SelectedState.NONE,
  };
}
