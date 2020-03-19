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
  AppState,
  CodeActionsState,
  DescriptionsState,
  DiagnosticMessage,
  DiagnosticMessages,
  DiagnosticMessageKind,
  Store,
  UiConfig,
  LastUpdateSource,
} from '../types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {throttle} from 'nuclide-commons/observable';
import * as Actions from '../redux/Actions';
import * as Selectors from '../redux/Selectors';
import observableFromReduxStore from 'nuclide-commons/observableFromReduxStore';
import {mapEqual} from 'nuclide-commons/collection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';

// Receiving all messages is potentially dangerous as there can sometimes be
// tens of thousands, and updates can occur **on keystroke**. Throttle these to
// half of a second.
const THROTTLE_ALL_MESSAGES_MS = 500;
const THROTTLE_FILE_MESSAGES_MS = 100;

export default class DiagnosticUpdater {
  _store: Store;
  _states: Observable<AppState>;
  _fileMessageObservables: Map<string, Observable<DiagnosticMessages>>;
  _fileMessageWithoutHintsObservables: Map<
    string,
    Observable<DiagnosticMessages>,
  >;
  _allMessagesObservable: Observable<Array<DiagnosticMessage>>;

  constructor(store: Store) {
    this._store = store;
    this._fileMessageObservables = new Map();
    this._fileMessageWithoutHintsObservables = new Map();
    this._states = observableFromReduxStore(store);
    this._allMessagesObservable = this._states
      .let(throttle(THROTTLE_ALL_MESSAGES_MS))
      .map(Selectors.getAllMessages)
      .distinctUntilChanged()
      .shareReplay(1);
  }

  getAllMessages = (): Array<DiagnosticMessage> => {
    return Selectors.getAllMessages(this._store.getState());
  };

  getFileMessages = (filePath: NuclideUri): DiagnosticMessages => {
    return Selectors.getFileMessages(this._store.getState())(filePath);
  };

  getLastUpdateSource = (): LastUpdateSource => {
    return this._store.getState().lastUpdateSource;
  };

  observeMessages = (
    callback: (messages: Array<DiagnosticMessage>) => mixed,
  ): IDisposable => {
    return new UniversalDisposable(
      this._allMessagesObservable.subscribe(callback),
    );
  };

  observeFileMessages = (
    filePath: NuclideUri,
    callback: (update: DiagnosticMessages) => mixed,
  ): IDisposable => {
    let observable = this._fileMessageObservables.get(filePath);
    if (observable == null) {
      // Whether that's worth it depends on how often this is actually called with the same path.
      observable = this._states
        .distinctUntilChanged((a, b) => a.messages === b.messages)
        .let(throttle(THROTTLE_FILE_MESSAGES_MS))
        .map(state => [
          Selectors.getProviderToMessagesForFile(state)(filePath),
          state,
        ])
        .distinctUntilChanged(([aMessages], [bMessages]) =>
          mapEqual(aMessages, bMessages),
        )
        .map(([, state]) => Selectors.getFileMessages(state)(filePath))
        .finally(() => {
          this._fileMessageObservables.delete(filePath);
        })
        .shareReplay(1);
      this._fileMessageObservables.set(filePath, observable);
    }
    return new UniversalDisposable(observable.subscribe(callback));
  };

  observeFileMessagesWithoutHints = (
    filePath: NuclideUri,
    callback: (update: DiagnosticMessages) => mixed,
  ): IDisposable => {
    let observable = this._fileMessageWithoutHintsObservables.get(filePath);
    if (observable == null) {
      observable = observableFromSubscribeFunction(cb =>
        this.observeFileMessages(filePath, cb),
      )
        .map(update => ({
          filePath: update.filePath,
          messages: update.messages.filter(m => m.type !== 'Hint'),
          totalMessages: update.totalMessages,
        }))
        .finally(() => {
          this._fileMessageWithoutHintsObservables.delete(filePath);
        })
        .share();
    }

    return new UniversalDisposable(observable.subscribe(callback));
  };

  observeCodeActionsForMessage = (
    callback: (update: CodeActionsState) => mixed,
  ): IDisposable => {
    return new UniversalDisposable(
      this._states
        .map(state => state.codeActionsForMessage)
        .distinctUntilChanged()
        .subscribe(callback),
    );
  };

  observeDescriptions = (
    callback: (update: DescriptionsState) => mixed,
  ): IDisposable => {
    return new UniversalDisposable(
      this._states
        .map(state => state.descriptions)
        .distinctUntilChanged()
        .subscribe(callback),
    );
  };

  observeSupportedMessageKinds = (
    callback: (kinds: Set<DiagnosticMessageKind>) => mixed,
  ): IDisposable => {
    return new UniversalDisposable(
      this._states.map(Selectors.getSupportedMessageKinds).subscribe(callback),
    );
  };

  observeUiConfig = (callback: (config: UiConfig) => mixed): IDisposable => {
    return new UniversalDisposable(
      this._states
        .map(Selectors.getUiConfig)
        // Being a selector means we'll always get the same ui config for a given
        // slice of state (in this case `state.providers`). However, other parts
        // of state may change. Don't emit in those cases, or in the common case
        // that the config changed from an empty array to a different empty array.
        .distinctUntilChanged(
          (a, b) => a === b || (a.length === 0 && b.length === 0),
        )
        .subscribe(callback),
    );
  };

  applyFix = (message: DiagnosticMessage): void => {
    this._store.dispatch(Actions.applyFix(message));
  };

  applyFixesForFile = (file: NuclideUri): void => {
    this._store.dispatch(Actions.applyFixesForFile(file));
  };

  fetchCodeActions = (
    editor: atom$TextEditor,
    messages: Array<DiagnosticMessage>,
  ): void => {
    this._store.dispatch(Actions.fetchCodeActions(editor, messages));
  };

  fetchDescriptions = (messages: Array<DiagnosticMessage>): void => {
    this._store.dispatch(Actions.fetchDescriptions(messages));
  };
}
