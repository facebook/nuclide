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

import type {
  Action,
  Executor,
  ConsoleSourceStatus,
  Record,
  RecordProvider,
  SourceInfo,
  Level,
} from '../types';

import type {CreatePasteFunction} from '../types';

export const CLEAR_RECORDS = 'CLEAR_RECORDS';
export const SET_CREATE_PASTE_FUNCTION = 'SET_CREATE_PASTE_FUNCTION';
export const SET_WATCH_EDITOR_FUNCTION = 'SET_WATCH_EDITOR_FUNCTION';
export const REGISTER_EXECUTOR = 'REGISTER_EXECUTOR';
export const EXECUTE = 'EXECUTE';
export const REGISTER_RECORD_PROVIDER = 'REGISTER_RECORD_PROVIDER';
export const SELECT_EXECUTOR = 'SELECT_EXECUTOR';
export const SET_MAX_MESSAGE_COUNT = 'SET_MAX_MESSAGE_COUNT';
export const RECORD_RECEIVED = 'RECORD_RECEIVED';
export const RECORD_UPDATED = 'RECORD_UPDATED';
export const REGISTER_SOURCE = 'REGISTER_SOURCE';
export const REMOVE_SOURCE = 'REMOVE_SOURCE';
export const UPDATE_STATUS = 'UPDATE_STATUS';
export const SET_FONT_SIZE = 'SET_FONT_SIZE';

export function clearRecords(): Action {
  return {type: CLEAR_RECORDS};
}

export function recordReceived(record: Record): Action {
  return {
    type: RECORD_RECEIVED,
    payload: {record},
  };
}

export function recordUpdated(
  messageId: string,
  appendText: ?string,
  overrideLevel: ?Level,
  setComplete: boolean,
): Action {
  return {
    type: RECORD_UPDATED,
    payload: {messageId, appendText, overrideLevel, setComplete},
  };
}

export function registerExecutor(executor: Executor): Action {
  return {
    type: REGISTER_EXECUTOR,
    payload: {executor},
  };
}

export function execute(code: string): Action {
  return {
    type: EXECUTE,
    payload: {code},
  };
}

export function registerRecordProvider(recordProvider: RecordProvider): Action {
  return {
    type: REGISTER_RECORD_PROVIDER,
    payload: {recordProvider},
  };
}

export function registerSource(source: SourceInfo): Action {
  return {
    type: REGISTER_SOURCE,
    payload: {source},
  };
}

export function unregisterRecordProvider(
  recordProvider: RecordProvider,
): Action {
  return removeSource(recordProvider.id);
}

export function selectExecutor(executorId: string): Action {
  return {
    type: SELECT_EXECUTOR,
    payload: {executorId},
  };
}

export function setMaxMessageCount(maxMessageCount: number): Action {
  return {
    type: SET_MAX_MESSAGE_COUNT,
    payload: {maxMessageCount},
  };
}

export function removeSource(sourceId: string): Action {
  return {
    type: REMOVE_SOURCE,
    payload: {sourceId},
  };
}

export function unregisterExecutor(executor: Executor): Action {
  return removeSource(executor.id);
}

export function updateStatus(
  providerId: string,
  status: ConsoleSourceStatus,
): Action {
  return {
    type: UPDATE_STATUS,
    payload: {providerId, status},
  };
}

export function setCreatePasteFunction(
  createPasteFunction: ?CreatePasteFunction,
): Action {
  return {
    type: SET_CREATE_PASTE_FUNCTION,
    payload: {createPasteFunction},
  };
}

export function setWatchEditor(
  watchEditor: ?atom$AutocompleteWatchEditor,
): Action {
  return {
    type: SET_WATCH_EDITOR_FUNCTION,
    payload: {watchEditor},
  };
}

export function setFontSize(fontSize: number): Action {
  return {
    type: SET_FONT_SIZE,
    payload: {fontSize},
  };
}
