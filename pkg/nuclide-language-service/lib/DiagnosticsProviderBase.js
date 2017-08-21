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

import type {
  DiagnosticInvalidationCallback,
  DiagnosticInvalidationMessage,
  DiagnosticProviderUpdate,
  DiagnosticUpdateCallback,
} from 'atom-ide-ui';

import {CompositeDisposable, Emitter} from 'atom';
import {TextEventDispatcher} from 'nuclide-commons-atom/text-event';

type ProviderBaseOptions = {
  /** The callback by which a provider is notified of text events, such as a file save. */
  onTextEditorEvent?: (editor: TextEditor) => mixed,
  /**
   * The callback by which a provider is notified that a new consumer has subscribed to diagnostic
   * updates.
   */
  onNewUpdateSubscriber?: (callback: DiagnosticUpdateCallback) => mixed,
  /**
   * The callback by which a provider is notified that a new consumer has subscribed to diagnostic
   * invalidations.
   */
  onNewInvalidateSubscriber?: (
    callback: DiagnosticInvalidationCallback,
  ) => mixed,
  /**
   * If true, this will cause onTextEditorEvent to get called more often -- approximately whenever
   * the user stops typing. If false, it will get called only when the user saves.
   */
  shouldRunOnTheFly?: boolean,
  /**
   * The following two options specify which grammars the provider is interested in. Most providers
   * will include a set of grammarScopes, and will therefore get notifications only about
   * TextEditors that are associated with those grammarScopes. Instead, a provider may set
   * enableForAllGrammars to true, and then it will get notified of changes in all TextEditors. If
   * enableForAllGrammars is true, it overrides the grammars in grammarScopes.
   */
  grammarScopes?: Set<string>,
  enableForAllGrammars?: boolean,
};

const UPDATE_EVENT = 'update';
const INVALIDATE_EVENT = 'invalidate';

let _textEventDispatcherInstance: ?TextEventDispatcher = null;

function getTextEventDispatcher(): TextEventDispatcher {
  if (_textEventDispatcherInstance == null) {
    _textEventDispatcherInstance = new TextEventDispatcher();
  }
  return _textEventDispatcherInstance;
}

export class DiagnosticsProviderBase {
  _textEventDispatcher: TextEventDispatcher;

  _emitter: Emitter;

  _grammarScopes: Set<string>;
  _allGrammarScopes: ?boolean;

  _currentEventSubscription: ?IDisposable;

  _disposables: atom$CompositeDisposable;

  // callbacks provided by client
  _textEventCallback: (editor: TextEditor) => mixed;
  _newUpdateSubscriberCallback: (callback: DiagnosticUpdateCallback) => mixed;
  _newInvalidateSubscriberCallback: (
    callback: DiagnosticInvalidationCallback,
  ) => mixed;

  constructor(
    options: ProviderBaseOptions,
    textEventDispatcher?: TextEventDispatcher = getTextEventDispatcher(),
  ) {
    this._textEventDispatcher = textEventDispatcher;
    this._emitter = new Emitter();
    this._disposables = new CompositeDisposable();

    this._textEventCallback = callbackOrNoop(options.onTextEditorEvent);
    this._newUpdateSubscriberCallback = callbackOrNoop(
      options.onNewUpdateSubscriber,
    );
    this._newInvalidateSubscriberCallback = callbackOrNoop(
      options.onNewInvalidateSubscriber,
    );

    // The Set constructor creates an empty Set if passed null or undefined.
    this._grammarScopes = new Set(options.grammarScopes);
    this._allGrammarScopes = Boolean(options.enableForAllGrammars);
    this._subscribeToTextEditorEvent(Boolean(options.shouldRunOnTheFly));
  }

  /**
   * Subscribes to the appropriate event depending on whether we should run on
   * the fly or not.
   */
  _subscribeToTextEditorEvent(shouldRunOnTheFly: boolean) {
    this._disposeEventSubscription();
    const dispatcher = this._textEventDispatcher;
    let subscription;
    if (shouldRunOnTheFly) {
      if (this._allGrammarScopes) {
        subscription = dispatcher.onAnyFileChange(this._textEventCallback);
      } else {
        subscription = dispatcher.onFileChange(
          this._grammarScopes,
          this._textEventCallback,
        );
      }
    } else {
      if (this._allGrammarScopes) {
        subscription = dispatcher.onAnyFileSave(this._textEventCallback);
      } else {
        subscription = dispatcher.onFileSave(
          this._grammarScopes,
          this._textEventCallback,
        );
      }
    }
    this._currentEventSubscription = subscription;
  }

  setRunOnTheFly(runOnTheFly: boolean) {
    this._subscribeToTextEditorEvent(runOnTheFly);
  }

  dispose(): void {
    this._emitter.dispose();
    this._disposables.dispose();
    this._disposeEventSubscription();
  }

  _disposeEventSubscription(): void {
    if (this._currentEventSubscription) {
      this._currentEventSubscription.dispose();
      this._currentEventSubscription = null;
    }
  }

  getGrammarScopes(): Set<string> {
    return this._grammarScopes;
  }

  /**
   * Clients can call these methods to publish messages
   */

  publishMessageUpdate(update: DiagnosticProviderUpdate): void {
    this._emitter.emit(UPDATE_EVENT, update);
  }

  publishMessageInvalidation(message: DiagnosticInvalidationMessage): void {
    this._emitter.emit(INVALIDATE_EVENT, message);
  }

  /**
   * Clients should delegate to these
   */

  onMessageUpdate(callback: DiagnosticUpdateCallback): IDisposable {
    const disposable = this._emitter.on(UPDATE_EVENT, callback);
    this._newUpdateSubscriberCallback(callback);
    return disposable;
  }

  onMessageInvalidation(callback: DiagnosticInvalidationCallback): IDisposable {
    const disposable = this._emitter.on(INVALIDATE_EVENT, callback);
    this._newInvalidateSubscriberCallback(callback);
    return disposable;
  }
}

function callbackOrNoop<T>(callback: ?(arg: T) => mixed): (arg: T) => mixed {
  return callback ? callback.bind(undefined) : () => {};
}
