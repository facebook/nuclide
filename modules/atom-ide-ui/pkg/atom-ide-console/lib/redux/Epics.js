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

import type {Action, Store} from '../types';
import type {ActionsObservable} from 'nuclide-commons/redux-observable';

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import * as Actions from './Actions';
import * as Selectors from './Selectors';
import invariant from 'assert';
import {Observable} from 'rxjs';
import analytics from 'nuclide-commons/analytics';

/**
 * Register a record provider for every executor.
 */
export function registerExecutorEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.REGISTER_EXECUTOR).map(action => {
    invariant(action.type === Actions.REGISTER_EXECUTOR);
    const {executor} = action.payload;
    return Actions.registerRecordProvider({
      id: executor.id,
      // $FlowIssue: Flow is having some trouble with the spread here.
      records: executor.output.map(message => ({
        ...message,
        // $FlowIssue: TODO with above.
        incomplete: message.incomplete ?? false,
        kind: 'response',
        sourceId: executor.id,
        scopeName: null, // The output won't be in the language's grammar.
        // Eventually, we'll want to allow providers to specify custom timestamps for records.
        timestamp: new Date(),
        executor,
      })),
    });
  });
}

/**
 * Execute the provided code using the current executor.
 */
export function executeEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.EXECUTE).flatMap(action => {
    invariant(action.type === Actions.EXECUTE);
    const {code} = action.payload;
    const currentExecutorId = Selectors.getCurrentExecutorId(store.getState());
    // flowlint-next-line sketchy-null-string:off
    invariant(currentExecutorId);

    const executor = store.getState().executors.get(currentExecutorId);
    invariant(executor != null);

    // TODO: Is this the best way to do this? Might want to go through nuclide-executors and have
    //       that register output sources?
    return (
      Observable.of(
        Actions.recordReceived({
          // Eventually, we'll want to allow providers to specify custom timestamps for records.
          timestamp: new Date(),
          sourceId: currentExecutorId,
          sourceName: executor.name,
          kind: 'request',
          level: 'log',
          text: code,
          scopeName: executor.scopeName(),
          repeatCount: 1,
          incomplete: false,
        }),
      )
        // Execute the code as a side-effect.
        .finally(() => {
          executor.send(code);
        })
    );
  });
}

export function trackEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<empty> {
  return actions
    .ofType(Actions.EXECUTE)
    .map(action => ({type: 'console:execute'}))
    .do(analytics.trackEvent)
    .ignoreElements();
}

export function registerRecordProviderEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.REGISTER_RECORD_PROVIDER).flatMap(action => {
    invariant(action.type === Actions.REGISTER_RECORD_PROVIDER);
    const {recordProvider} = action.payload;

    // Transform the messages into actions and merge them into the action stream.
    // TODO: Add enabling/disabling of registered source and only subscribe when enabled. That
    //       way, we won't trigger cold observer side-effects when we don't need the results.
    const messageActions = recordProvider.records.map(Actions.recordReceived);

    // TODO: Can this be delayed until sometime after registration?
    const statusActions =
      // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
      typeof recordProvider.observeStatus === 'function'
        ? observableFromSubscribeFunction(recordProvider.observeStatus).map(
            status => Actions.updateStatus(recordProvider.id, status),
          )
        : Observable.empty();

    const unregisteredEvents = actions
      .ofType(Actions.REMOVE_SOURCE)
      .filter(a => {
        invariant(a.type === Actions.REMOVE_SOURCE);
        return a.payload.sourceId === recordProvider.id;
      });

    return Observable.merge(
      Observable.of(
        Actions.registerSource({...recordProvider, name: recordProvider.id}),
      ),
      messageActions,
      statusActions,
    ).takeUntil(unregisteredEvents);
  });
}
