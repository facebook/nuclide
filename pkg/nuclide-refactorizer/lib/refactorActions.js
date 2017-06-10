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

import type {AvailableRefactoring, RefactorRequest, RefactorProvider} from '..';

import type {
  ApplyAction,
  CloseAction,
  ConfirmAction,
  ErrorAction,
  ErrorSource,
  ExecuteAction,
  GotRefactoringsAction,
  OpenAction,
  ProgressAction,
  PickedRefactorAction,
  RefactorUI,
} from './types';

import type {RefactorEditResponse} from './rpc-types';

export function open(ui: RefactorUI): OpenAction {
  return {
    type: 'open',
    ui,
  };
}

export function gotRefactorings(
  editor: atom$TextEditor,
  originalPoint: atom$Point,
  provider: RefactorProvider,
  availableRefactorings: Array<AvailableRefactoring>,
): GotRefactoringsAction {
  return {
    type: 'got-refactorings',
    payload: {
      editor,
      originalPoint,
      provider,
      availableRefactorings,
    },
  };
}

export function error(source: ErrorSource, err: Error): ErrorAction {
  return {
    type: 'error',
    payload: {
      source,
      error: err,
    },
  };
}

export function pickedRefactor(
  refactoring: AvailableRefactoring,
): PickedRefactorAction {
  return {
    type: 'picked-refactor',
    payload: {
      refactoring,
    },
  };
}

export function execute(
  provider: RefactorProvider,
  refactoring: RefactorRequest,
): ExecuteAction {
  return {
    type: 'execute',
    payload: {
      provider,
      refactoring,
    },
  };
}

export function confirm(response: RefactorEditResponse): ConfirmAction {
  return {
    type: 'confirm',
    payload: {response},
  };
}

export function apply(response: RefactorEditResponse): ApplyAction {
  return {
    type: 'apply',
    payload: {response},
  };
}

export function progress(
  message: string,
  value: number,
  max: number,
): ProgressAction {
  return {
    type: 'progress',
    payload: {message, value, max},
  };
}

export function close(): CloseAction {
  return {
    type: 'close',
  };
}
