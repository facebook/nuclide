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
  CodeActionsState,
  DiagnosticMessage,
  DiagnosticMessages,
  Store,
  DiagnosticMessageKind,
  UiConfig,
} from '../types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import * as Actions from '../redux/Actions';
import * as Selectors from '../redux/Selectors';
import {arrayEqual} from 'nuclide-commons/collection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';

export default class DiagnosticUpdater {
  _store: Store;
  _states: Observable<AppState>;
  _allMessageUpdates: Observable<Array<DiagnosticMessage>>;

  constructor(store: Store) {
    this._store = store;
    // $FlowIgnore: Flow doesn't know about Symbol.observable
    this._states = Observable.from(store);

    this._allMessageUpdates = this._states
      .map(Selectors.getMessages)
      .distinctUntilChanged();
  }

  getMessages = (): Array<DiagnosticMessage> => {
    return Selectors.getMessages(this._store.getState());
  };

  getFileMessageUpdates = (filePath: NuclideUri): DiagnosticMessages => {
    return Selectors.getFileMessageUpdates(this._store.getState(), filePath);
  };

  observeMessages = (
    callback: (messages: Array<DiagnosticMessage>) => mixed,
  ): IDisposable => {
    return new UniversalDisposable(this._allMessageUpdates.subscribe(callback));
  };

  observeFileMessages = (
    filePath: NuclideUri,
    callback: (update: DiagnosticMessages) => mixed,
  ): IDisposable => {
    return new UniversalDisposable(
      // TODO: As a potential perf improvement, we could cache so the mapping only happens once.
      // Whether that's worth it depends on how often this is actually called with the same path.
      this._states
        .distinctUntilChanged((a, b) => a.messages === b.messages)
        .map(state => Selectors.getFileMessageUpdates(state, filePath))
        .distinctUntilChanged((a, b) => arrayEqual(a.messages, b.messages))
        .subscribe(callback),
    );
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

  observeSupportedMessageKinds = (
    callback: (kinds: Set<DiagnosticMessageKind>) => mixed,
  ): IDisposable => {
    return new UniversalDisposable(
      this._states.map(Selectors.getSupportedMessageKinds).subscribe(callback),
    );
  };

  observeUiConfig = (callback: (config: UiConfig) => mixed): IDisposable => {
    return new UniversalDisposable(
      this._states.map(Selectors.getUiConfig).subscribe(callback),
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
}
