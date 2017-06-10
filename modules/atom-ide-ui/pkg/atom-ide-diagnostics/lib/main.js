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

import type {Observable} from 'rxjs';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {LinterAdapter} from './LinterAdapter';
import type {IndieLinterDelegate} from './IndieLinterRegistry';

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {getLogger} from 'log4js';

import DiagnosticStore from './DiagnosticStore';
import {createAdapters} from './LinterAdapterFactory';
import IndieLinterRegistry from './IndieLinterRegistry';

import type {
  InvalidationMessage,
  DiagnosticProviderUpdate,
  FileDiagnosticMessage,
  FileDiagnosticUpdate,
  Fix,
  MessageType,
  ProjectDiagnosticMessage,
  Trace,
} from './rpc-types';

export type {
  InvalidationMessage,
  DiagnosticProviderUpdate,
  FileDiagnosticMessage,
  FileDiagnosticUpdate,
  Fix,
  MessageType,
  ProjectDiagnosticMessage,
  Trace,
};

export type MessageUpdateCallback = (update: DiagnosticProviderUpdate) => mixed;
export type MessageInvalidationCallback = (
  message: InvalidationMessage,
) => mixed;

// TODO figure out how to allow the diagnostic consumer to poll (for example, if
// it was just activated and wants diagnostic messages without having to wait
// for an event to occur)
export type CallbackDiagnosticProvider = {
  onMessageUpdate(callback: MessageUpdateCallback): IDisposable,
  onMessageInvalidation(callback: MessageInvalidationCallback): IDisposable,
};

export type ObservableDiagnosticProvider = {
  updates: Observable<DiagnosticProviderUpdate>,
  invalidations: Observable<InvalidationMessage>,
};

export type DiagnosticProvider =
  | CallbackDiagnosticProvider
  | ObservableDiagnosticProvider;

export type FileMessageUpdate = {
  filePath: NuclideUri,
  messages: Array<FileDiagnosticMessage>,
};

export type DiagnosticMessage =
  | FileDiagnosticMessage
  | ProjectDiagnosticMessage;

export type DiagnosticUpdater = {
  onFileMessagesDidUpdate: (
    callback: (update: FileMessageUpdate) => mixed,
    filePath: NuclideUri,
  ) => IDisposable,
  onProjectMessagesDidUpdate: (
    callback: (messages: Array<ProjectDiagnosticMessage>) => mixed,
  ) => IDisposable,
  onAllMessagesDidUpdate: (
    callback: (messages: Array<DiagnosticMessage>) => mixed,
  ) => IDisposable,
  applyFix: (message: FileDiagnosticMessage) => void,
  applyFixesForFile: (file: NuclideUri) => void,
};

export type ObservableDiagnosticUpdater = {
  // All observables here will issue an initial value on subscribe.

  // Sent only when the messages for a given file change. Consumers may use this to avoid
  // unnecessary work if the file(s) they are interested in are not changed.
  getFileMessageUpdates: (
    filePath: NuclideUri,
  ) => Observable<FileMessageUpdate>,
  // Sent whenever any project message changes.
  projectMessageUpdates: Observable<Array<ProjectDiagnosticMessage>>,
  // Sent whenever any message changes, and includes all messages.
  allMessageUpdates: Observable<Array<DiagnosticMessage>>,
  applyFix: (message: FileDiagnosticMessage) => void,
  applyFixesForFile: (file: NuclideUri) => void,
};

/**
 * Linter APIs, for compatibility with the Atom linter package.
 */

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

type RegisterIndieLinter = ({name: string}) => IndieLinterDelegate;

class Activation {
  _disposables: UniversalDisposable;
  _diagnosticStore: DiagnosticStore;

  _diagnosticUpdater: ?DiagnosticUpdater;
  _observableDiagnosticUpdater: ?ObservableDiagnosticUpdater;

  _allLinterAdapters: Set<LinterAdapter>;
  _indieRegistry: ?IndieLinterRegistry;

  constructor() {
    this._allLinterAdapters = new Set();
    this._diagnosticStore = new DiagnosticStore();

    this._disposables = new UniversalDisposable(this._diagnosticStore, () => {
      this._allLinterAdapters.forEach(adapter => adapter.dispose());
      this._allLinterAdapters.clear();
    });
  }

  dispose() {
    this._disposables.dispose();
  }

  _getIndieRegistry(): IndieLinterRegistry {
    if (this._indieRegistry == null) {
      const registry = new IndieLinterRegistry();
      this._disposables.add(registry);
      this._indieRegistry = registry;
      return registry;
    }
    return this._indieRegistry;
  }

  /**
   * @return A wrapper around the methods on DiagnosticStore that allow reading data.
   */
  provideDiagnosticUpdates(): DiagnosticUpdater {
    if (!this._diagnosticUpdater) {
      const store = this._diagnosticStore;
      this._diagnosticUpdater = {
        onFileMessagesDidUpdate: store.onFileMessagesDidUpdate.bind(store),
        onProjectMessagesDidUpdate: store.onProjectMessagesDidUpdate.bind(
          store,
        ),
        onAllMessagesDidUpdate: store.onAllMessagesDidUpdate.bind(store),
        applyFix: store.applyFix.bind(store),
        applyFixesForFile: store.applyFixesForFile.bind(store),
      };
    }
    return this._diagnosticUpdater;
  }

  provideObservableDiagnosticUpdates(): ObservableDiagnosticUpdater {
    if (this._observableDiagnosticUpdater == null) {
      const store = this._diagnosticStore;
      this._observableDiagnosticUpdater = {
        getFileMessageUpdates: path => store.getFileMessageUpdates(path),
        projectMessageUpdates: store.getProjectMessageUpdates(),
        allMessageUpdates: store.getAllMessageUpdates(),
        applyFix: message => store.applyFix(message),
        applyFixesForFile: file => store.applyFixesForFile(file),
      };
    }
    return this._observableDiagnosticUpdater;
  }

  provideIndie(): RegisterIndieLinter {
    return config => {
      const delegate = this._getIndieRegistry().register(config);
      const disposable = this.consumeDiagnosticsProviderV2(delegate);
      delegate.onDidDestroy(() => {
        disposable.dispose();
      });
      return delegate;
    };
  }

  consumeLinterProvider(
    provider: LinterProvider | Array<LinterProvider>,
  ): IDisposable {
    const newAdapters = createAdapters(provider);
    const adapterDisposables = new UniversalDisposable();
    for (const adapter of newAdapters) {
      this._allLinterAdapters.add(adapter);
      const diagnosticDisposable = this.consumeDiagnosticsProviderV2({
        updates: adapter.getUpdates(),
        invalidations: adapter.getInvalidations(),
      });
      adapterDisposables.add(() => {
        diagnosticDisposable.dispose();
        adapter.dispose();
        this._allLinterAdapters.delete(adapter);
      });
    }
    return adapterDisposables;
  }

  consumeDiagnosticsProviderV1(
    provider: CallbackDiagnosticProvider,
  ): IDisposable {
    // Register the diagnostic store for updates from the new provider.
    const observableProvider = {
      updates: observableFromSubscribeFunction(
        provider.onMessageUpdate.bind(provider),
      ),
      invalidations: observableFromSubscribeFunction(
        provider.onMessageInvalidation.bind(provider),
      ),
    };
    return this.consumeDiagnosticsProviderV2(observableProvider);
  }

  consumeDiagnosticsProviderV2(
    provider: ObservableDiagnosticProvider,
  ): IDisposable {
    const store = this._diagnosticStore;

    const subscriptions = new UniversalDisposable(
      provider.updates.subscribe(
        update => store.updateMessages(provider, update),
        error => {
          getLogger('atom-ide-diagnostics').error(
            `Error: updates.subscribe ${error}`,
          );
        },
        () => {
          getLogger('atom-ide-diagnostics').error(
            'updates.subscribe completed',
          );
        },
      ),
      provider.invalidations.subscribe(
        invalidation => store.invalidateMessages(provider, invalidation),
        error => {
          getLogger('atom-ide-diagnostics').error(
            `Error: invalidations.subscribe ${error}`,
          );
        },
        () => {
          getLogger('atom-ide-diagnostics').error(
            'invalidations.subscribe completed',
          );
        },
      ),
    );
    this._disposables.add(subscriptions);

    return new UniversalDisposable(
      // V1 providers have no way of terminating the streams, so unsubscribe just in case.
      subscriptions,
      () => {
        // When the provider package goes away, we need to invalidate its messages.
        store.invalidateMessages(provider, {scope: 'all'});
      },
    );
  }
}

createPackage(module.exports, Activation);
