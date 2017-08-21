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
  FileDiagnosticMessage,
  ProjectDiagnosticMessage,
} from '../types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

/**
  * Gets the current diagnostic messages for the file.
  * Prefer to get updates via ::onFileMessagesDidUpdate.
  */
export function getFileMessages(
  state: AppState,
  filePath: NuclideUri,
): Array<FileDiagnosticMessage> {
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

/**
  * Gets the current project-scope diagnostic messages.
  * Prefer to get updates via ::onProjectMessagesDidUpdate.
  */
export function getProjectMessages(
  state: AppState,
): Array<ProjectDiagnosticMessage> {
  const messages = [];
  for (const providerMessages of state.projectMessages.values()) {
    messages.push(...providerMessages);
  }
  return messages;
}

/**
  * Gets all current diagnostic messages.
  * Prefer to get updates via ::onAllMessagesDidUpdate.
  */
export function getAllMessages(state: AppState): Array<DiagnosticMessage> {
  const messages = [];

  // Get all file messages.
  for (const providerMessages of state.messages.values()) {
    for (const fileMessages of providerMessages.values()) {
      messages.push(...fileMessages);
    }
  }

  // Get all project messages.
  messages.push(...getProjectMessages(state));

  return messages;
}
