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
  FileDiagnosticMessages,
  ProjectDiagnosticMessage,
  Store,
} from '../types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import * as Actions from '../redux/Actions';
import {arrayEqual, arrayFlatten} from 'nuclide-commons/collection';
import {cacheWhileSubscribed} from 'nuclide-commons/observable';
import {Observable} from 'rxjs';

// All observables here will issue an initial value on subscribe.
export default class ObservableDiagnosticUpdater {
  _store: Store;
  _states: Observable<AppState>;

  allMessageUpdates: Observable<Array<DiagnosticMessage>>;
  projectMessageUpdates: Observable<Array<ProjectDiagnosticMessage>>;

  constructor(store: Store) {
    this._store = store;
    // $FlowIgnore: Flow doesn't know about Symbol.observable
    this._states = Observable.from(store).share();

    // Cache so the mapping only happens once per update, and only when we have subscribers.
    this.projectMessageUpdates = cacheWhileSubscribed(
      Observable.defer(() =>
        this._states
          .startWith(this._store.getState())
          .map(state => state.projectMessages)
          .distinctUntilChanged()
          .map(projectMessages => arrayFlatten([...projectMessages.values()])),
      ),
    );

    // Cache so the mapping only happens once per update, and only when we have subscribers.
    // TODO: As a potential perf improvement, we could precalculate this in the reducer.
    this.allMessageUpdates = cacheWhileSubscribed(
      Observable.defer(() =>
        this._states.startWith(this._store.getState()).map(state => {
          const projectMessages = arrayFlatten(
            Array.from(state.projectMessages.values()),
          );
          const fileScopedMessageMaps = Array.from(state.messages.values());
          const ungrouped = fileScopedMessageMaps.map(map =>
            Array.from(map.values()),
          );
          const flattened = arrayFlatten(arrayFlatten(ungrouped));
          return [...projectMessages, ...flattened];
        }),
      ),
    );
  }

  getFileMessageUpdates(
    filePath: NuclideUri,
  ): Observable<FileDiagnosticMessages> {
    // TODO: As a potential perf improvement, we could cache so the mapping only happens once.
    // Whether that's worth it depends on how often this is actually called with the same path.
    return this._states
      .startWith(this._store.getState())
      .map(state => state.messages)
      .distinctUntilChanged()
      .map(pathsToMessages => {
        const pathToMessageMaps = Array.from(pathsToMessages.values());
        const messages = arrayFlatten(
          pathToMessageMaps.map(
            pathToMessageMap => pathToMessageMap.get(filePath) || [],
          ),
        );
        return messages;
      })
      .distinctUntilChanged(arrayEqual)
      .map(messages => ({filePath, messages}));
  }

  applyFix(message: FileDiagnosticMessage): void {
    this._store.dispatch(Actions.applyFix(message));
  }

  applyFixesForFile(file: NuclideUri): void {
    this._store.dispatch(Actions.applyFixesForFile(file));
  }
}
