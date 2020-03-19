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

import {combineEpicsFromImports} from 'nuclide-commons/epicHelpers';
import {createEpicMiddleware} from 'nuclide-commons/redux-observable';
import {diffSets, throttle} from 'nuclide-commons/observable';
import observableFromReduxStore from 'nuclide-commons/observableFromReduxStore';
import * as Selectors from './Selectors';
import * as Reducers from './Reducers';
import * as Epics from './Epics';
import {
  applyMiddleware,
  combineReducers,
  createStore as _createStore,
} from 'redux';
import {Observable} from 'rxjs';

// Unlike text decorations, these don't need to be rapidly updated on screen as
// the user types, though they need to be reasonably responsive once the user
// accepts a fix and the diagnostic (hopefully) disappears as a result.
const THROTTLE_MESSAGES_WITH_FIXES = 300;

export default function createStore(
  messageRangeTracker: MessageRangeTracker,
  initialState: AppState = INITIAL_STATE,
): Store {
  const rootEpic = (actions, store) =>
    combineEpicsFromImports(Epics, 'atom-ide-diagnostics')(actions, store, {
      messageRangeTracker,
    });
  const store = _createStore(
    combineReducers(Reducers),
    initialState,
    applyMiddleware(createEpicMiddleware(rootEpic)),
  );

  // When we get new messages with fixes, track them.
  // eslint-disable-next-line nuclide-internal/unused-subscription
  observeAllMessagesWithFixes(store)
    .let(diffSets())
    .subscribe(({added, removed}) => {
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
  descriptions: new Map(),
  providers: new Set(),
  lastUpdateSource: 'Provider',
};

function observeAllMessagesWithFixes(
  store: Store,
): Observable<Set<DiagnosticMessage>> {
  return (
    observableFromReduxStore(store)
      .map(state => state.messages)
      .distinctUntilChanged()
      // The initial state of messages is an empty map which would otherwise
      // immediately start a throttle cooldown. Filter these out eaglery
      // before throttling as we're not interested in them anyway.
      .filter(messages => messages.size > 0)
      .let(throttle(THROTTLE_MESSAGES_WITH_FIXES))
      .map(() => Selectors.getAllMessagesWithFixes(store.getState()))
      .filter(messagesWithFixes => messagesWithFixes.size > 0)
  );
}
