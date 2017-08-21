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
  Action,
  Executor,
  OutputProvider,
  OutputProviderStatus,
  Record,
  RecordProvider,
  SourceInfo,
} from '../types';

import type {CreatePasteFunction} from '../../../nuclide-paste-base';

export const CLEAR_RECORDS = 'CLEAR_RECORDS';
export const SET_CREATE_PASTE_FUNCTION = 'SET_CREATE_PASTE_FUNCTION';
export const REGISTER_EXECUTOR = 'REGISTER_EXECUTOR';
export const EXECUTE = 'EXECUTE';
export const REGISTER_RECORD_PROVIDER = 'REGISTER_RECORD_PROVIDER';
export const SELECT_EXECUTOR = 'SELECT_EXECUTOR';
export const SET_MAX_MESSAGE_COUNT = 'SET_MAX_MESSAGE_COUNT';
export const RECORD_RECEIVED = 'RECORD_RECEIVED';
export const REGISTER_SOURCE = 'REGISTER_SOURCE';
export const REMOVE_SOURCE = 'REMOVE_SOURCE';
export const UPDATE_STATUS = 'UPDATE_STATUS';

export function clearRecords(): Action {
  return {type: CLEAR_RECORDS};
}

export function recordReceived(record: Record): Action {
  return {
    type: RECORD_RECEIVED,
    payload: {record},
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

export function registerOutputProvider(outputProvider: OutputProvider): Action {
  // Transform the messages into actions and merge them into the action stream.
  // TODO: Add enabling/disabling of registered source and only subscribe when enabled. That
  //       way, we won't trigger cold observer side-effects when we don't need the results.
  return registerRecordProvider({
    ...outputProvider,
    records: outputProvider.messages.map(message => ({
      // We duplicate the properties here instead of using spread because Flow (currently) has some
      // issues with spread.
      text: message.text,
      level: message.level,
      data: message.data,
      tags: message.tags,

      kind: 'message',
      sourceId: outputProvider.id,
      scopeName: null,
      // Eventually, we'll want to allow providers to specify custom timestamps for records.
      timestamp: new Date(),
    })),
  });
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

export function unregisterOutputProvider(
  outputProvider: OutputProvider,
): Action {
  return removeSource(outputProvider.id);
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
  status: OutputProviderStatus,
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
