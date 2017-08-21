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

import type {Observable} from 'rxjs';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {IndieLinterDelegate} from './services/IndieLinterRegistry';

export type DiagnosticProvider =
  | CallbackDiagnosticProvider
  | ObservableDiagnosticProvider;

export type CallbackDiagnosticProvider = {
  onMessageUpdate(callback: DiagnosticUpdateCallback): IDisposable,
  onMessageInvalidation(callback: DiagnosticInvalidationCallback): IDisposable,
};

export type DiagnosticUpdateCallback = (
  update: DiagnosticProviderUpdate,
) => mixed;

export type DiagnosticInvalidationCallback = (
  message: DiagnosticInvalidationMessage,
) => mixed;

export type ObservableDiagnosticProvider = {
  updates: Observable<DiagnosticProviderUpdate>,
  invalidations: Observable<DiagnosticInvalidationMessage>,
};

export type DiagnosticInvalidationMessage =
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

export type DiagnosticMessageType = 'Error' | 'Warning' | 'Info';

export type DiagnosticTrace = {
  type: 'Trace',
  text?: string,
  html?: string,
  filePath?: NuclideUri,
  range?: atom$Range,
};

export type DiagnosticFix = TextEdit & {
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
  type: DiagnosticMessageType,
  filePath: NuclideUri,
  text?: string,
  html?: string,
  range?: atom$Range,
  trace?: Array<DiagnosticTrace>,
  fix?: DiagnosticFix,
  // Indicates that the message should still be displayed, but there should be some UI indicating
  // that it is out of date. TODO(matthewwithanm) implement this UI.
  stale?: boolean,
};

export type ProjectDiagnosticMessage = {
  scope: 'project',
  providerName: string,
  type: DiagnosticMessageType,
  text?: string,
  html?: string,
  range?: atom$Range,
  trace?: Array<DiagnosticTrace>,
  stale?: boolean,
};

export type FileDiagnosticMessages = {
  filePath: NuclideUri,
  messages: Array<FileDiagnosticMessage>,
};

export type DiagnosticMessage =
  | FileDiagnosticMessage
  | ProjectDiagnosticMessage;

export type {
  default as ObservableDiagnosticUpdater,
} from './services/ObservableDiagnosticUpdater';

//
//
// Linter APIs, for compatibility with the Atom linter package.
//
//

export type LinterTrace = {
  type: 'Trace',
  text?: string,
  html?: string,
  filePath: string,
  range?: atom$Range,
};

export type LinterMessageV1 = {
  type: 'Error' | 'Warning' | 'Info',
  text?: string,
  html?: string,
  /*
   * Allows overriding of the LinterProvider name per message. Useful for when
   * a provider's messages come from multiple lint sources.
   */
  name?: string,
  filePath?: NuclideUri,
  range?: atom$RangeLike,
  trace?: Array<LinterTrace>,
  fix?: {
    range: atom$RangeLike,
    newText: string,
    oldText?: string,
  },
};

export type LinterMessageV2 = {
  type?: void, // Hint for Flow.
  location: {
    file: string,
    position: atom$RangeLike,
  },
  reference?: {
    file: string,
    position?: atom$PointLike,
  },
  // Extension: preserve the v1 traces API, as it's still pretty useful.
  // Languages like C++ can have errors with a huge stack, so one reference isn't enough.
  // `reference` will be ignored if this is provided.
  trace?: Array<LinterTrace>,
  // TODO: use the URL and icon fields.
  url?: string,
  icon?: string,
  excerpt: string,
  severity: 'error' | 'warning' | 'info',
  // TODO: only the first solution is used at the moment.
  solutions?: Array<
    | {
      title?: string,
      position: atom$RangeLike,
      priority?: number,
      currentText?: string,
      replaceWith: string,
    }
    | {
      // TODO: not currently supported.
      title?: string,
      position: atom$RangeLike,
      priority?: number,
      apply: () => any,
      replaceWith?: void, // Hint for Flow.
    },
  >,
  // TODO: the callback version is not supported.
  description?: string | (() => Promise<string> | string),
  linterName?: string,
};

export type LinterMessage = LinterMessageV1 | LinterMessageV2;

export type LinterProvider = {
  name: string,
  grammarScopes: Array<string>,
  scope: 'file' | 'project',
  // Linter v2 renames lintOnFly to lintsOnChange. Accept both.
  lintsOnChange?: boolean,
  lintOnFly?: boolean,
  lint: (textEditor: TextEditor) => ?Promise<?Array<LinterMessage>>,
};

export type RegisterIndieLinter = ({name: string}) => IndieLinterDelegate;
export type {IndieLinterDelegate} from './services/IndieLinterRegistry';

//
//
// Redux
//
//

export type AppState = {
  messages: MessagesState,
  projectMessages: ProjectMessagesState,
};

export type MessagesState = Map<
  ObservableDiagnosticProvider,
  Map<NuclideUri, Array<FileDiagnosticMessage>>,
>;

export type ProjectMessagesState = Map<
  ObservableDiagnosticProvider,
  Array<ProjectDiagnosticMessage>,
>;

export type Store = {
  getState(): AppState,
  dispatch(action: Action): void,
};

export type Action =
  // Providers
  | {
    type: 'ADD_PROVIDER',
    payload: {provider: ObservableDiagnosticProvider},
  }
  | {
    type: 'REMOVE_PROVIDER',
    payload: {provider: ObservableDiagnosticProvider},
  }

  // Fixes
  | {
    type: 'APPLY_FIX',
    payload: {
      message: FileDiagnosticMessage,
    },
  }
  | {
    type: 'APPLY_FIXES_FOR_FILE',
    payload: {
      file: NuclideUri,
    },
  }
  | {type: 'FIX_FAILED'}
  | {
    type: 'FIXES_APPLIED',
    payload: {
      filePath: NuclideUri,
      messages: Set<FileDiagnosticMessage>,
    },
  }

  // Messages
  | {
    type: 'UPDATE_MESSAGES',
    payload: {
      provider: ObservableDiagnosticProvider,
      update: DiagnosticProviderUpdate,
    },
  }
  | {
    type: 'INVALIDATE_MESSAGES',
    payload: {
      provider: ObservableDiagnosticProvider,
      invalidation: DiagnosticInvalidationMessage,
    },
  };
