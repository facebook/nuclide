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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  Action,
  CodeActionsState,
  DescriptionsState,
  DiagnosticInvalidationMessage,
  DiagnosticProviderUpdate,
  DiagnosticMessage,
  ObservableDiagnosticProvider,
} from '../types';
import type {CodeActionFetcher} from '../../../atom-ide-code-actions/lib/types';

export const ADD_PROVIDER = 'ADD_PROVIDER';
export const REMOVE_PROVIDER = 'REMOVE_PROVIDER';
export const SET_CODE_ACTION_FETCHER = 'SET_CODE_ACTION_FETCHER';
export const FETCH_CODE_ACTIONS = 'FETCH_CODE_ACTIONS';
export const SET_CODE_ACTIONS = 'SET_CODE_ACTIONS';
export const FETCH_DESCRIPTIONS = 'FETCH_DESCRIPTIONS';
export const SET_DESCRIPTIONS = 'SET_DESCRIPTIONS';
export const UPDATE_MESSAGES = 'UPDATE_MESSAGES';
export const INVALIDATE_MESSAGES = 'INVALIDATE_MESSAGES';
export const APPLY_FIX = 'APPLY_FIX';
export const APPLY_FIXES_FOR_FILE = 'APPLY_FIXES_FOR_FILE';
export const FIX_FAILED = 'FIX_FAILED';
export const FIXES_APPLIED = 'FIXES_APPLIED';
export const MARK_MESSAGES_STALE = 'MARK_MESSAGES_STALE';

export function addProvider(provider: ObservableDiagnosticProvider): Action {
  return {
    type: ADD_PROVIDER,
    payload: {provider},
  };
}

export function markMessagesStale(filePath: string): Action {
  return {
    type: MARK_MESSAGES_STALE,
    payload: {filePath},
  };
}

export function removeProvider(provider: ObservableDiagnosticProvider): Action {
  return {
    type: REMOVE_PROVIDER,
    payload: {provider},
  };
}

export function setCodeActionFetcher(
  codeActionFetcher: ?CodeActionFetcher,
): Action {
  return {
    type: SET_CODE_ACTION_FETCHER,
    payload: {codeActionFetcher},
  };
}

export function fetchCodeActions(
  editor: atom$TextEditor,
  messages: Array<DiagnosticMessage>,
): Action {
  return {
    type: FETCH_CODE_ACTIONS,
    payload: {editor, messages},
  };
}

export function setCodeActions(
  codeActionsForMessage: CodeActionsState,
): Action {
  return {
    type: SET_CODE_ACTIONS,
    payload: {codeActionsForMessage},
  };
}

export function fetchDescriptions(messages: Array<DiagnosticMessage>): Action {
  return {
    type: FETCH_DESCRIPTIONS,
    payload: {messages},
  };
}

export function setDescriptions(
  descriptions: DescriptionsState,
  keepDescriptions: boolean,
): Action {
  return {
    type: SET_DESCRIPTIONS,
    payload: {descriptions, keepDescriptions},
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

export function applyFix(message: DiagnosticMessage): Action {
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
  messages: Set<DiagnosticMessage>,
): Action {
  return {
    type: FIXES_APPLIED,
    payload: {filePath, messages},
  };
}
