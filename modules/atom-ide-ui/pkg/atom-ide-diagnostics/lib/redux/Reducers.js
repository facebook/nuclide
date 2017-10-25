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

import type {
  Action,
  CodeActionsState,
  MessagesState,
  ObservableDiagnosticProvider,
} from '../types';
import type {CodeActionFetcher} from '../../../atom-ide-code-actions/lib/types';

import * as Actions from './Actions';

export function messages(
  state: MessagesState = new Map(),
  action: Action,
): MessagesState {
  switch (action.type) {
    case Actions.UPDATE_MESSAGES: {
      const {provider, update} = action.payload;
      const nextState = new Map(state);
      // Override the messages we already have for each path.
      const prevMessages = nextState.get(provider) || new Map();
      // This O(n) map copying means that a series of streaming updates will be O(n^2). However,
      // we'd like to keep this immutable and we're also accumulating the messages, (and therefore
      // already O(n^2)). So, for now, we'll accept that and revisit if it proves to be a
      // bottleneck.
      const nextMessages = new Map([...prevMessages, ...update]);
      nextState.set(provider, nextMessages);
      return nextState;
    }
    case Actions.INVALIDATE_MESSAGES: {
      const {provider, invalidation} = action.payload;

      // If there aren't any messages for this provider, there's nothing to do.
      const filesToMessages = state.get(provider);
      if (filesToMessages == null || filesToMessages.size === 0) {
        return state;
      }

      switch (invalidation.scope) {
        case 'all': {
          // Clear the messages for this provider.
          const nextState = new Map(state);
          nextState.set(provider, new Map());
          return nextState;
        }
        case 'file': {
          let nextMessages;
          for (const filePath of invalidation.filePaths) {
            // If we have messages for this path, clear them. We take care not to update the state
            // if we don't have any messages for the paths.
            const messagesForFile = filesToMessages.get(filePath);
            if (messagesForFile != null && messagesForFile.length > 0) {
              nextMessages = nextMessages || new Map(filesToMessages);
              nextMessages.delete(filePath);
            }
          }
          // If we didn't update the messages, we don't need to update the state.
          if (nextMessages == null) {
            return state;
          }
          const nextState = new Map(state);
          nextState.set(provider, nextMessages);
          return nextState;
        }
        default:
          (invalidation.scope: empty);
          throw new Error(`Invalid scope: ${invalidation.scope}`);
      }
    }
    case Actions.FIXES_APPLIED: {
      const {messages: messagesToRemove, filePath} = action.payload;

      if (messagesToRemove.length === 0) {
        return state;
      }

      // When a fix is applied, immediately remove that message from the state.
      let nextState;
      for (const [provider, pathsToMessages] of state) {
        const providerMessages = pathsToMessages.get(filePath);
        if (providerMessages == null || providerMessages.size === 0) {
          // There aren't any messages for this provider, so we don't have to remove anything.
          continue;
        }
        const filtered = providerMessages.filter(
          message => !messagesToRemove.has(message),
        );
        if (filtered.length === providerMessages.length) {
          // We didn't actually remove anything.
          continue;
        }
        if (nextState == null) {
          nextState = new Map(state);
        }
        const nextPathsToMessages = new Map(pathsToMessages);
        nextPathsToMessages.set(filePath, filtered);
        nextState.set(provider, nextPathsToMessages);
      }

      return nextState || state;
    }
    case Actions.REMOVE_PROVIDER: {
      return mapDelete(state, action.payload.provider);
    }
  }

  return state;
}

export function codeActionFetcher(
  state: ?CodeActionFetcher = null,
  action: Action,
): ?CodeActionFetcher {
  if (action.type === 'SET_CODE_ACTION_FETCHER') {
    return action.payload.codeActionFetcher;
  }
  return state;
}

export function codeActionsForMessage(
  state: CodeActionsState = new Map(),
  action: Action,
): CodeActionsState {
  if (action.type === 'SET_CODE_ACTIONS') {
    state.forEach(codeActions => {
      codeActions.forEach(codeAction => codeAction.dispose());
    });
    return action.payload.codeActionsForMessage;
  }
  return state;
}

export function providers(
  state: Set<ObservableDiagnosticProvider> = new Set(),
  action: Action,
): Set<ObservableDiagnosticProvider> {
  switch (action.type) {
    case Actions.ADD_PROVIDER: {
      const nextState = new Set(state);
      nextState.add(action.payload.provider);
      return nextState;
    }
    case Actions.REMOVE_PROVIDER: {
      const nextState = new Set(state);
      nextState.delete(action.payload.provider);
      return nextState;
    }
  }
  return state;
}

/**
 * Delete a key from a map, treating is as an immutable collection. If the key isn't present, the
 * same map will be returned. Otherwise, a copy will be made missing the key.
 */
function mapDelete<K, V>(map: Map<K, V>, key: K): Map<K, V> {
  if (map.has(key)) {
    const copy = new Map(map);
    copy.delete(key);
    return copy;
  }
  return map;
}
