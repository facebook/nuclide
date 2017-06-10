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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import type {TextEdit} from 'nuclide-commons-atom/text-edit';

export type InvalidationMessage =
  | {
      scope: 'file',
      filePaths: Array<NuclideUri>,
    }
  | {
      scope: 'project',
    }
  | {
      scope: 'all',
    };

// Implicit invalidation semantics:
//
// - Previous 'file' scope messages are invalidated if and only if
// filePathToMessages contains their key as a path.
//
// - All previous 'project' scope messages are invalidated whenever
// projectMessages is populated.
export type DiagnosticProviderUpdate = {
  filePathToMessages?: Map<NuclideUri, Array<FileDiagnosticMessage>>,
  projectMessages?: Array<ProjectDiagnosticMessage>,
};

export type FileDiagnosticUpdate = {
  filePath: NuclideUri,
  messages: Array<FileDiagnosticMessage>,
};

export type MessageType = 'Error' | 'Warning' | 'Info';

export type Trace = {
  type: 'Trace',
  text?: string,
  html?: string,
  filePath?: NuclideUri,
  range?: atom$Range,
};

export type Fix = TextEdit & {
  // If true, we will be more conservative about applying the fix (e.g. it will not be automatically
  // fixed with the "fix all in current file" command, instead an explicit interaction with this fix
  // will be required).
  speculative?: boolean,
  // Text to display in the UI. (defaults to "Fix")
  title?: string,
};

export type FileDiagnosticMessage = {
  scope: 'file',
  providerName: string,
  type: MessageType,
  filePath: NuclideUri,
  text?: string,
  html?: string,
  range?: atom$Range,
  trace?: Array<Trace>,
  fix?: Fix,
  // Indicates that the message should still be displayed, but there should be some UI indicating
  // that it is out of date. TODO(matthewwithanm) implement this UI.
  stale?: boolean,
};

export type ProjectDiagnosticMessage = {
  scope: 'project',
  providerName: string,
  type: MessageType,
  text?: string,
  html?: string,
  range?: atom$Range,
  trace?: Array<Trace>,
  stale?: boolean,
};
