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
  DiagnosticMessage,
  DiagnosticMessages,
  DiagnosticMessageKind,
  MessagesState,
  ObservableDiagnosticProvider,
  UiConfig,
} from '../types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {createSelector} from 'reselect';
import {DefaultMap, takeIterable} from 'nuclide-commons/collection';
import {memoize, minBy} from 'lodash';

const MAX_MESSAGE_COUNT_PER_FILE = 1000;

const getMessagesState = state => state.messages;
const getProviders = state => state.providers;

const getFileMessageCount = createSelector(
  [getMessagesState],
  (messages: MessagesState): ((filePath: NuclideUri) => number) => {
    return memoize((filePath: NuclideUri) => {
      let messageCount = 0;
      for (const providerMessages of messages.values()) {
        const messagesForFile = providerMessages.get(filePath);
        if (messagesForFile == null) {
          continue;
        }
        messageCount += messagesForFile.length;
      }
      return messageCount;
    });
  },
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getProviderToMessagesForFile = createSelector(
  [getMessagesState],
  messages => (filePath: string) => {
    const providerToMessages = new Map();
    for (const [provider, providerMessages] of messages) {
      const fileMessages = providerMessages.get(filePath);
      if (fileMessages != null && fileMessages.length > 0) {
        providerToMessages.set(provider, fileMessages);
      }
    }
    return providerToMessages;
  },
);

const getThreadedFileMessages = createSelector(
  [getProviderToMessagesForFile],
  _getProviderToMessagesForFile => {
    return function* _getThreadedFileMessages(
      filePath: NuclideUri,
    ): Iterable<DiagnosticMessage> {
      const providerToMessages = _getProviderToMessagesForFile(filePath);
      const providerToCurrentIndex: DefaultMap<
        ObservableDiagnosticProvider,
        number,
      > = new DefaultMap(() => 0);

      while (providerToMessages.size) {
        // "Peek" at the next message from each provider, and store them so we can
        // select the best next one.
        const nextMessageCandidates: Array<
          [ObservableDiagnosticProvider, DiagnosticMessage],
        > = Array.from(providerToMessages.entries()).map(
          ([provider, messages]) => [
            provider,
            messages[providerToCurrentIndex.get(provider)],
          ],
        );

        // Pick the "closest" (lowest row and column pair) of the options we generated
        const [closestProvider, closestMessage] = minBy(
          nextMessageCandidates,
          ([provider, message]) => {
            const range = message && message.range;
            return range
              ? range.start.row + range.start.column / Number.MAX_SAFE_INTEGER
              : 0;
          },
        );

        // Advance this provider's index forward one. First, get "i"
        const closestProviderIndex = providerToCurrentIndex.get(
          closestProvider,
        );
        const closestProviderMessages = providerToMessages.get(closestProvider);
        if (
          closestProviderMessages != null &&
          closestProviderIndex < closestProviderMessages.length - 1
        ) {
          // "i++"
          providerToCurrentIndex.set(closestProvider, closestProviderIndex + 1);
        } else {
          // We've exhausted the messages for this provider. Remove it from future
          // consideration.
          providerToMessages.delete(closestProvider);
        }

        yield closestMessage;
      }
    };
  },
);

const getBoundedThreadedFileMessages = createSelector(
  [getThreadedFileMessages],
  _getThreadedFileMessages =>
    memoize(
      (filePath: NuclideUri): Array<DiagnosticMessage> =>
        Array.from(
          takeIterable(
            _getThreadedFileMessages(filePath),
            MAX_MESSAGE_COUNT_PER_FILE,
          ),
        ),
    ),
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getFileMessages = createSelector(
  [getBoundedThreadedFileMessages, getFileMessageCount],
  (
    messagesForFilePath,
    countForFilePath,
  ): ((filePath: NuclideUri) => DiagnosticMessages) =>
    memoize(
      (filePath: NuclideUri): DiagnosticMessages => ({
        filePath,
        // Excessive numbers of items cause performance issues in the gutter, table, and decorations.
        // Truncate the number of items MAX_MESSAGE_COUNT_PER_FILE.
        messages: messagesForFilePath(filePath),
        // Include the total number of messages without truncation
        totalMessages: countForFilePath(filePath),
      }),
    ),
);

/**
 * Gets all current diagnostic messages.
 * Prefer to get updates via ::onAllMessagesDidUpdate.
 */
// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getAllMessages = createSelector(
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

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getAllMessagesWithFixes = createSelector(
  [getMessagesState],
  (messagesState): Set<DiagnosticMessage> => {
    // Intentionally does not use the `getMessages` selector so this is O(n*m*p)
    // rather than O(2n*m*p) and to avoid turning the array into a set
    const withFixes = new Set();
    for (const providerMessageMap of messagesState.values()) {
      for (const providerMessages of providerMessageMap.values()) {
        for (let i = 0; i < providerMessages.length; i++) {
          if (providerMessages[i].fix != null) {
            withFixes.add(providerMessages[i]);
          }
        }
      }
    }
    return withFixes;
  },
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
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

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
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
