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

import type {Action, AppState, Record} from '../types';

import {List} from 'immutable';
import {arrayEqual} from 'nuclide-commons/collection';
import * as Actions from './Actions';

const RECORD_PROPERTIES_TO_COMPARE = [
  'text',
  'level',
  'format',
  'scopeName',
  'sourceId',
  'kind',
];

function shouldAccumulateRecordCount(
  recordA: Record,
  recordB: Record,
): boolean {
  if (
    String(recordA.sourceId)
      .toLowerCase()
      .includes('debugger') ||
    String(recordB.sourceId)
      .toLowerCase()
      .includes('debugger')
  ) {
    return false;
  }

  // Never merge incomplete records.
  if (recordA.incomplete || recordB.incomplete) {
    return false;
  }

  const areRelevantPropertiesEqual = RECORD_PROPERTIES_TO_COMPARE.every(
    prop => recordA[prop] === recordB[prop],
  );

  // if data exists, we should not accumulate this into the previous record
  const doesDataExist =
    (recordA.expressions && recordA.expressions.length > 0) ||
    (recordB.expressions && recordB.expressions.length > 0);

  const recATags = recordA.tags;
  const recBTags = recordB.tags;
  const areTagsEqual =
    (!recATags && !recBTags) ||
    (recATags && recBTags && arrayEqual(recATags, recBTags));

  return (
    areRelevantPropertiesEqual &&
    !Boolean(doesDataExist) &&
    Boolean(areTagsEqual)
  );
}

export default function accumulateState(
  state: AppState,
  action: Action,
): AppState {
  switch (action.type) {
    case Actions.RECORD_RECEIVED: {
      const {record} = action.payload;
      let {records, incompleteRecords} = state;

      if (record.incomplete) {
        incompleteRecords = incompleteRecords.push(record);
      } else {
        // check if the message is exactly the same as the previous one, if so
        // we add a count to it.
        const lastRecord = records.last();
        if (
          lastRecord != null &&
          shouldAccumulateRecordCount(lastRecord, record)
        ) {
          // Update the last record. Don't use `splice()` because that's O(n)
          const updatedRecord: Record = {
            ...lastRecord,
            repeatCount: lastRecord.repeatCount + 1,
            timestamp: record.timestamp,
          };
          records = records.pop().push(updatedRecord);
        } else {
          records = records.push(record);
        }

        if (records.size > state.maxMessageCount) {
          // We could only have gone over by one.
          records = records.shift();
        }
      }

      return {
        ...state,
        records,
        incompleteRecords,
      };
    }
    case Actions.RECORD_UPDATED: {
      let {records, incompleteRecords} = state;
      const {
        messageId,
        appendText,
        overrideLevel,
        setComplete,
      } = action.payload;

      let found = false;
      for (let i = 0; i < incompleteRecords.size; i++) {
        const record = incompleteRecords.get(i);
        if (record != null && record.messageId === messageId) {
          // Create a replacement message object with the new properties.
          const newRecord = {
            ...record,
            text: appendText != null ? record.text + appendText : record.text,
            level: overrideLevel != null ? overrideLevel : record.level,
            incomplete: !setComplete,
          };

          if (setComplete) {
            incompleteRecords = incompleteRecords.remove(i);
            records = records.push(newRecord);
            if (records.size > state.maxMessageCount) {
              records = records.shift();
            }
          } else {
            incompleteRecords = incompleteRecords.set(i, newRecord);
          }

          found = true;
          break;
        }
      }

      if (!found) {
        throw new Error(
          `Expected incomplete console message with id ${messageId} not found`,
        );
      }

      return {
        ...state,
        records,
        incompleteRecords,
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
        records: List(),
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
      const newHistory =
        state.history[state.history.length - 1] === command
          ? state.history
          : state.history.concat(command);
      return {
        ...state,
        history: newHistory.slice(-1000),
      };
    }
    case Actions.SET_CREATE_PASTE_FUNCTION: {
      const {createPasteFunction} = action.payload;
      return {
        ...state,
        createPasteFunction,
      };
    }
    case Actions.SET_WATCH_EDITOR_FUNCTION: {
      const {watchEditor} = action.payload;
      return {
        ...state,
        watchEditor,
      };
    }
    case Actions.SET_FONT_SIZE: {
      const {fontSize} = action.payload;
      return {
        ...state,
        fontSize,
      };
    }
  }

  return state;
}
