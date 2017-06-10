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

import type {Action, AppState} from '../types';

import * as Actions from './Actions';

export default function accumulateState(
  state: AppState,
  action: Action,
): AppState {
  switch (action.type) {
    case Actions.RECORD_RECEIVED: {
      const {record} = action.payload;
      return {
        ...state,
        records: state.records.concat(record).slice(-state.maxMessageCount),
      };
    }
    case Actions.SET_MAX_MESSAGE_COUNT: {
      const {maxMessageCount} = action.payload;
      if (maxMessageCount <= 0) {
        return state;
      }
      return {
        ...state,
        maxMessageCount,
        records: state.records.slice(-maxMessageCount),
      };
    }
    case Actions.REGISTER_SOURCE: {
      const {source} = action.payload;
      return {
        ...state,
        providers: new Map(state.providers).set(source.id, {
          ...source,
          name: source.name || source.id,
        }),
      };
    }
    case Actions.CLEAR_RECORDS: {
      return {
        ...state,
        records: [],
      };
    }
    case Actions.REGISTER_EXECUTOR: {
      const {executor} = action.payload;
      return {
        ...state,
        executors: new Map(state.executors).set(executor.id, executor),
      };
    }
    case Actions.SELECT_EXECUTOR: {
      const {executorId} = action.payload;
      return {
        ...state,
        currentExecutorId: executorId,
      };
    }
    case Actions.REMOVE_SOURCE: {
      const {sourceId} = action.payload;
      const providers = new Map(state.providers);
      const providerStatuses = new Map(state.providerStatuses);
      const executors = new Map(state.executors);
      providers.delete(sourceId);
      providerStatuses.delete(sourceId);
      executors.delete(sourceId);
      return {
        ...state,
        providers,
        providerStatuses,
        executors,
      };
    }
    case Actions.UPDATE_STATUS: {
      const {status, providerId} = action.payload;
      return {
        ...state,
        providerStatuses: new Map(state.providerStatuses).set(
          providerId,
          status,
        ),
      };
    }
    case Actions.EXECUTE: {
      const command = action.payload.code;
      return {
        ...state,
        history: state.history.concat(command).slice(-1000),
      };
    }
  }

  return state;
}
