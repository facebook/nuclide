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

import type {AvailableRefactoring} from '..';

import type {
  ConfirmAction,
  ExecuteAction,
  GotRefactoringsAction,
  OpenAction,
  PickedRefactorAction,
  PickPhase,
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
    case 'picked-refactor':
      return pickedRefactor(state, action);
    case 'execute':
      return executeRefactor(state, action);
    case 'confirm':
      return confirmRefactor(state, action);
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

  const {editor, originalPoint} = action.payload;

  return {
    type: 'open',
    ui: state.ui,
    phase: {
      type: 'pick',
      provider: action.payload.provider,
      editor,
      originalPoint,
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

function pickedRefactor(
  state: RefactorState,
  action: PickedRefactorAction,
): RefactorState {
  invariant(state.type === 'open');
  invariant(state.phase.type === 'pick');

  return {
    type: 'open',
    ui: state.ui,
    phase: getRefactoringPhase(action.payload.refactoring, state.phase),
  };
}

function getRefactoringPhase(
  refactoring: AvailableRefactoring,
  {provider, editor, originalPoint}: PickPhase,
): RefactoringPhase {
  switch (refactoring.kind) {
    case 'rename':
      return {
        type: 'rename',
        provider,
        editor,
        originalPoint,
        symbolAtPoint: refactoring.symbolAtPoint,
      };
    case 'freeform':
      return {
        type: 'freeform',
        provider,
        editor,
        originalPoint,
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
