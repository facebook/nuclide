/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {RefactorProvider, AvailableRefactoring} from './types';

import type {
  BackFromDiffPreviewAction,
  ConfirmAction,
  DisplayDiffPreviewAction,
  ExecuteAction,
  GotRefactoringsAction,
  LoadDiffPreviewAction,
  DisplayRenameAction,
  OpenAction,
  PickedRefactorAction,
  ProgressAction,
  RefactorAction,
  RefactoringPhase,
  RefactorState,
} from './types';

import invariant from 'assert';

export default function refactorReducers(
  state_: ?RefactorState,
  action: RefactorAction,
): RefactorState {
  let state = state_;
  if (state == null) {
    state = {type: 'closed'};
  }

  // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
  if (action.error) {
    // We handle errors in epics, display an appropriate message, and then send an ordinary action
    // to update the state appropriately.
    return state;
  }

  switch (action.type) {
    case 'open':
      return open(state, action);
    case 'got-refactorings':
      return gotRefactorings(state, action);
    case 'close':
      return close(state);
    case 'back-from-diff-preview':
      return backFromDiffPreview(state, action);
    case 'picked-refactor':
      return pickedRefactor(state, action);
    case 'execute':
      return executeRefactor(state, action);
    case 'confirm':
      return confirmRefactor(state, action);
    case 'load-diff-preview':
      return loadDiffPreview(state, action);
    case 'display-diff-preview':
      return displayDiffPreview(state, action);
    case 'display-rename':
      return displayRename(state, action);
    case 'progress':
      return progress(state, action);
    default:
      return state;
  }
}

function open(state: RefactorState, action: OpenAction): RefactorState {
  invariant(state.type === 'closed');

  return {
    type: 'open',
    ui: action.ui,
    phase: {
      type: 'get-refactorings',
    },
  };
}

function gotRefactorings(
  state: RefactorState,
  action: GotRefactoringsAction,
): RefactorState {
  invariant(state.type === 'open');
  invariant(state.phase.type === 'get-refactorings');

  const {editor, originalRange} = action.payload;

  return {
    type: 'open',
    ui: state.ui,
    phase: {
      type: 'pick',
      providers: action.payload.providers,
      editor,
      originalRange,
      availableRefactorings: action.payload.availableRefactorings,
    },
  };
}

function close(state: RefactorState): RefactorState {
  invariant(state.type === 'open');
  return {
    type: 'closed',
  };
}

function backFromDiffPreview(
  state: RefactorState,
  action: BackFromDiffPreviewAction,
): RefactorState {
  invariant(state.type === 'open');

  return {
    ...state,
    phase: action.payload.phase,
  };
}

function pickedRefactor(
  state: RefactorState,
  action: PickedRefactorAction,
): RefactorState {
  invariant(state.type === 'open');
  invariant(state.phase.type === 'pick');

  const {refactoring} = action.payload;
  const {providers, editor, originalRange} = state.phase;

  return {
    type: 'open',
    ui: state.ui,
    phase: getRefactoringPhase(refactoring, providers, editor, originalRange),
  };
}

function getRefactoringPhase(
  refactoring: AvailableRefactoring,
  providers: RefactorProvider[],
  editor: atom$TextEditor,
  originalRange: atom$Range,
): RefactoringPhase {
  switch (refactoring.kind) {
    case 'freeform':
      return {
        type: 'freeform',
        providers,
        editor,
        originalRange,
        refactoring,
      };
    default:
      invariant(false, `Unexpected refactoring kind ${refactoring.kind}`);
  }
}

function executeRefactor(
  state: RefactorState,
  action: ExecuteAction,
): RefactorState {
  invariant(state.type === 'open');
  return {
    type: 'open',
    ui: state.ui,
    phase: {
      type: 'execute',
    },
  };
}

function confirmRefactor(
  state: RefactorState,
  action: ConfirmAction,
): RefactorState {
  invariant(state.type === 'open');
  return {
    type: 'open',
    ui: state.ui,
    phase: {
      type: 'confirm',
      response: action.payload.response,
    },
  };
}

function loadDiffPreview(
  state: RefactorState,
  action: LoadDiffPreviewAction,
): RefactorState {
  invariant(state.type === 'open');

  return {
    ...state,
    phase: {
      type: 'diff-preview',
      loading: true,
      diffs: [],
      previousPhase: action.payload.previousPhase,
    },
  };
}

function displayDiffPreview(
  state: RefactorState,
  action: DisplayDiffPreviewAction,
): RefactorState {
  invariant(state.type === 'open');
  invariant(state.phase.type === 'diff-preview');

  return {
    ...state,
    phase: {
      ...state.phase,
      loading: false,
      diffs: action.payload.diffs,
    },
  };
}

function displayRename(
  state: RefactorState,
  action: DisplayRenameAction,
): RefactorState {
  const {
    providers,
    editor,
    selectedText,
    mountPosition,
    symbolPosition,
  } = action.payload;

  return {
    type: 'open',
    ui: 'rename', // Rename doesn't use MainRefactorComponent so we forgo `state.ui`
    phase: {
      type: 'rename',
      providers,
      editor,
      selectedText,
      mountPosition,
      symbolPosition,
    },
  };
}

function progress(state: RefactorState, action: ProgressAction): RefactorState {
  invariant(state.type === 'open');
  return {
    type: 'open',
    ui: state.ui,
    phase: {
      type: 'progress',
      ...action.payload,
    },
  };
}
