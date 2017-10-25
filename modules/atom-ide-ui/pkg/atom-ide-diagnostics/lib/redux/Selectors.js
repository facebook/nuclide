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
  AppState,
  DiagnosticMessage,
  DiagnosticMessages,
  DiagnosticMessageKind,
  UiConfig,
} from '../types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {createSelector} from 'reselect';

const getMessagesState = state => state.messages;
const getProviders = state => state.providers;

/**
  * Gets the current diagnostic messages for the file.
  * Prefer to get updates via ::onFileMessagesDidUpdate.
  */
export function getFileMessages(
  state: AppState,
  filePath: NuclideUri,
): Array<DiagnosticMessage> {
  const messages = [];
  for (const providerMessages of state.messages.values()) {
    const messagesForFile = providerMessages.get(filePath);
    if (messagesForFile == null) {
      continue;
    }
    messages.push(...messagesForFile);
  }
  return messages;
}

export function getFileMessageUpdates(
  state: AppState,
  filePath: NuclideUri,
): DiagnosticMessages {
  return {
    filePath,
    messages: getFileMessages(state, filePath),
  };
}

/**
  * Gets all current diagnostic messages.
  * Prefer to get updates via ::onAllMessagesDidUpdate.
  */
export const getMessages = createSelector(
  [getMessagesState],
  (messagesState): Array<DiagnosticMessage> => {
    const messages = [];

    // Get all file messages.
    for (const providerMessages of messagesState.values()) {
      for (const fileMessages of providerMessages.values()) {
        messages.push(...fileMessages);
      }
    }

    return messages;
  },
);

export const getSupportedMessageKinds = createSelector(
  [getProviders],
  (providers): Set<DiagnosticMessageKind> => {
    const kinds = new Set(['lint']); // Lint is always supported.
    providers.forEach(provider => {
      if (provider.supportedMessageKinds != null) {
        provider.supportedMessageKinds.forEach(kind => {
          kinds.add(kind);
        });
      }
    });
    return kinds;
  },
);

export const getUiConfig = createSelector(
  [getProviders],
  (providers): UiConfig => {
    const config = [];
    providers.forEach(provider => {
      if (
        provider.name != null &&
        provider.uiSettings != null &&
        provider.uiSettings.length > 0
      ) {
        config.push({
          providerName: provider.name,
          settings: provider.uiSettings,
        });
      }
    });
    return config;
  },
);
