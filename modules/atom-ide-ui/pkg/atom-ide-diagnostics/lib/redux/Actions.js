/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  Action,
  DiagnosticInvalidationMessage,
  DiagnosticProviderUpdate,
  FileDiagnosticMessage,
  ObservableDiagnosticProvider,
} from '../types';

export const ADD_PROVIDER = 'ADD_PROVIDER';
export const REMOVE_PROVIDER = 'REMOVE_PROVIDER';
export const UPDATE_MESSAGES = 'UPDATE_MESSAGES';
export const INVALIDATE_MESSAGES = 'INVALIDATE_MESSAGES';
export const APPLY_FIX = 'APPLY_FIX';
export const APPLY_FIXES_FOR_FILE = 'APPLY_FIXES_FOR_FILE';
export const FIX_FAILED = 'FIX_FAILED';
export const FIXES_APPLIED = 'FIXES_APPLIED';

export function addProvider(provider: ObservableDiagnosticProvider): Action {
  return {
    type: ADD_PROVIDER,
    payload: {provider},
  };
}

export function removeProvider(provider: ObservableDiagnosticProvider): Action {
  return {
    type: REMOVE_PROVIDER,
    payload: {provider},
  };
}

export function invalidateMessages(
  provider: ObservableDiagnosticProvider,
  invalidation: DiagnosticInvalidationMessage,
): Action {
  return {
    type: INVALIDATE_MESSAGES,
    payload: {provider, invalidation},
  };
}

// TODO: This will become `{provider, path: ?NuclideUri, messages: Array<Message>}` eventually, with
// a null path representing a project diagnostic.
export function updateMessages(
  provider: ObservableDiagnosticProvider,
  update: DiagnosticProviderUpdate,
): Action {
  return {
    type: UPDATE_MESSAGES,
    payload: {
      provider,
      update,
    },
  };
}

export function applyFix(message: FileDiagnosticMessage): Action {
  return {
    type: APPLY_FIX,
    payload: {
      message,
    },
  };
}

export function applyFixesForFile(file: NuclideUri): Action {
  return {
    type: APPLY_FIXES_FOR_FILE,
    payload: {
      file,
    },
  };
}

export function fixFailed(): Action {
  return {type: FIX_FAILED};
}

export function fixesApplied(
  filePath: NuclideUri,
  messages: Set<FileDiagnosticMessage>,
): Action {
  return {
    type: FIXES_APPLIED,
    payload: {filePath, messages},
  };
}
