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

import type {Action, Store} from '../types';
import type {ActionsObservable} from '../../../commons-node/redux-observable';

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import * as Actions from './Actions';
import getCurrentExecutorId from '../getCurrentExecutorId';
import invariant from 'assert';
import {Observable} from 'rxjs';

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
        kind: 'response',
        sourceId: executor.id,
        scopeName: null, // The output won't be in the language's grammar.
        // Eventually, we'll want to allow providers to specify custom timestamps for records.
        timestamp: new Date(),
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
    const currentExecutorId = getCurrentExecutorId(store.getState());
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
          kind: 'request',
          level: 'log',
          text: code,
          scopeName: executor.scopeName,
          data: null,
        }),
      )
        // Execute the code as a side-effect.
        .finally(() => {
          executor.send(code);
        })
    );
  });
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
    const statusActions = typeof recordProvider.observeStatus === 'function'
      ? observableFromSubscribeFunction(
          recordProvider.observeStatus,
        ).map(status => Actions.updateStatus(recordProvider.id, status))
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
