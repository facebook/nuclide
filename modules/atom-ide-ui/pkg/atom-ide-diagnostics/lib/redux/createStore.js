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

import type {AppState, DiagnosticMessage, Store} from '../types';
import type MessageRangeTracker from '../MessageRangeTracker';

import {
  combineEpics,
  createEpicMiddleware,
} from 'nuclide-commons/redux-observable';
import {arrayFlatten, setFilter} from 'nuclide-commons/collection';
import {diffSets} from 'nuclide-commons/observable';
import * as Reducers from './Reducers';
import * as Epics from './Epics';
import {getLogger} from 'log4js';
import {
  applyMiddleware,
  combineReducers,
  createStore as _createStore,
} from 'redux';
import {Observable} from 'rxjs';

export default function createStore(
  messageRangeTracker: MessageRangeTracker,
  initialState: AppState = INITIAL_STATE,
): Store {
  const epics = Object.keys(Epics)
    .map(k => Epics[k])
    .filter(epic => typeof epic === 'function');
  const rootEpic = (actions, store) =>
    combineEpics(...epics)(actions, store, {messageRangeTracker})
      // Log errors and continue.
      .catch((err, stream) => {
        getLogger('atom-ide-diagnostics').error(err);
        return stream;
      });
  const store = _createStore(
    combineReducers(Reducers),
    initialState,
    applyMiddleware(createEpicMiddleware(rootEpic)),
  );

  // When we get new messages with fixes, track them.
  const messagesWithFixes = getFileMessages(store)
    .map(messageSet => setFilter(messageSet, message => message.fix != null))
    .filter(messageSet => messageSet.size > 0);
  messagesWithFixes.let(diffSets()).subscribe(({added, removed}) => {
    if (added.size > 0) {
      messageRangeTracker.addFileMessages(added);
    }
    if (removed.size > 0) {
      messageRangeTracker.removeFileMessages(removed);
    }
  });

  return store;
}

const INITIAL_STATE = {
  messages: new Map(),
  codeActionFetcher: null,
  codeActionsForMessage: new Map(),
  providers: new Set(),
};

function getFileMessages(store: Store): Observable<Set<DiagnosticMessage>> {
  // $FlowFixMe: Flow doesn't understand Symbol.observable.
  const states: Observable<AppState> = Observable.from(store);
  return states
    .map(state => state.messages)
    .distinctUntilChanged()
    .map(messages => {
      const pathsToFileMessages = [...messages.values()];
      const allMessages = arrayFlatten(
        pathsToFileMessages.map(map => arrayFlatten([...map.values()])),
      );
      return new Set(allMessages);
    });
}
