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
import type {
  CodeAction,
  CodeActionFetcher,
} from '../../atom-ide-code-actions/lib/types';
import * as React from 'react';

export type UiConfig = Array<{|providerName: string, settings: Array<string>|}>;

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
  +name?: string, // TODO: This should probably be required. It is by the Indie API and is very useful.
  updates: Observable<DiagnosticProviderUpdate>,
  invalidations: Observable<DiagnosticInvalidationMessage>,
  +supportedMessageKinds?: Array<DiagnosticMessageKind>,
  +uiSettings?: Array<string>,
};

export type DiagnosticInvalidationMessage =
  | {
      scope: 'file',
      filePaths: Array<NuclideUri>,
    }
  | {
      scope: 'all',
    };

/**
 * Note: All provided map keys will be automatically invalidated on update.
 */
export type DiagnosticProviderUpdate = Map<
  NuclideUri,
  Array<DiagnosticMessage>,
>;

export type DiagnosticMessageKind = 'lint' | 'review' | 'action';
export type DiagnosticMessageType = 'Error' | 'Warning' | 'Info' | 'Hint';

export type DiagnosticTrace = {
  type: 'Trace',
  // At least one of text/html must be provided.
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

export type DiagnosticAction = {
  apply: () => mixed,
  title: string,
};

export type DiagnosticMessage = {|
  id?: ?string,
  kind?: DiagnosticMessageKind,
  providerName: string,
  type: DiagnosticMessageType, // TODO: Rename to severity.
  filePath: NuclideUri,
  text?: string,
  html?: string,
  +description?: string | (() => Promise<string> | string),
  range?: atom$Range,
  trace?: Array<DiagnosticTrace>,
  fix?: DiagnosticFix,
  // Actions will be displayed below the description in the popup.
  +actions?: Array<DiagnosticAction>,
  // Indicates that the message should still be displayed, but there should be some UI indicating
  // that it is out of date. TODO(matthewwithanm) implement this UI.
  stale?: boolean,
  code?: number,
  getBlockComponent?: ?() => React.ComponentType<any>,
|};

export type DiagnosticMessages = {|
  filePath: NuclideUri,
  // Note: This list of messages can be incomplete. A simple comparison of
  // `messages.length === totalMessages` can be used to determine if it is complete.
  messages: Array<DiagnosticMessage>,
  totalMessages: number,
|};

export type {default as DiagnosticUpdater} from './services/DiagnosticUpdater';

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
  range?: atom$RangeLike,
};

export type LinterMessageV1 = {
  // Should be Error / Warning / Info, but no guarantees.
  type: string,
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
  id?: string,
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
  // custom extension
  kind?: DiagnosticMessageKind,
  getBlockComponent?: ?() => React.ComponentType<any>,
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

export type LinterConfig = {
  name: string,

  // Optional, extended fields.

  // What kinds of messages can this provider emit? This helps as when creating the UI as we won't,
  // for example, show the "review" filter button unless there's a provider that supports review
  // messages.
  supportedMessageKinds?: Array<DiagnosticMessageKind>,

  // Important settings for this provider that should be surfaced by the primary UI.
  uiSettings?: Array<string>,
};
export type RegisterIndieLinter = (config: LinterConfig) => IndieLinterDelegate;
export type {IndieLinterDelegate} from './services/IndieLinterRegistry';

//
//
// Redux
//
//

export type AppState = {
  messages: MessagesState,
  codeActionFetcher: ?CodeActionFetcher,
  codeActionsForMessage: CodeActionsState,
  descriptions: DescriptionsState,
  providers: Set<ObservableDiagnosticProvider>,
  lastUpdateSource: LastUpdateSource,
};

export type MessagesState = Map<
  ObservableDiagnosticProvider,
  Map<NuclideUri, Array<DiagnosticMessage>>,
>;

export type LastUpdateSource = 'Provider' | 'Stale';

export type CodeActionsState = Map<DiagnosticMessage, Map<string, CodeAction>>;
export type DescriptionsState = Map<DiagnosticMessage, string>;

export type Store = {
  subscribe(() => void): () => void,
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

  // Code Actions
  | {
      type: 'SET_CODE_ACTION_FETCHER',
      payload: {codeActionFetcher: ?CodeActionFetcher},
    }
  | {
      type: 'FETCH_CODE_ACTIONS',
      payload: {editor: atom$TextEditor, messages: Array<DiagnosticMessage>},
    }
  | {
      type: 'SET_CODE_ACTIONS',
      payload: {codeActionsForMessage: CodeActionsState},
    }

  // Description
  | {
      type: 'FETCH_DESCRIPTIONS',
      payload: {messages: Array<DiagnosticMessage>},
    }
  | {
      type: 'SET_DESCRIPTIONS',
      payload: {descriptions: DescriptionsState, keepDescriptions: boolean},
    }

  // Fixes
  | {
      type: 'APPLY_FIX',
      payload: {
        message: DiagnosticMessage,
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
        messages: Set<DiagnosticMessage>,
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
    }
  | {
      type: 'MARK_MESSAGES_STALE',
      payload: {
        filePath: NuclideUri,
      },
    };
