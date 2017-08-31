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

import type {ActionsObservable} from 'nuclide-commons/redux-observable';
import type {Action, Store} from '../types';
import type MessageRangeTracker from '../MessageRangeTracker';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';

import invariant from 'assert';
import {getLogger} from 'log4js';
import {applyTextEdits} from 'nuclide-commons-atom/text-edit';
import {Observable} from 'rxjs';
import * as Actions from './Actions';
import * as Selectors from './Selectors';

export function addProvider(
  actions: ActionsObservable<Action>,
): Observable<Action> {
  return actions.ofType(Actions.ADD_PROVIDER).mergeMap(action => {
    invariant(action.type === Actions.ADD_PROVIDER);
    const {provider} = action.payload;
    const updateActions: Observable<Action> = provider.updates.map(update =>
      Actions.updateMessages(provider, update),
    );
    const invalidationActions: Observable<
      Action,
    > = provider.invalidations.map(invalidation =>
      Actions.invalidateMessages(provider, invalidation),
    );
    const removed = actions
      .filter(
        a =>
          a.type === Actions.REMOVE_PROVIDER && a.payload.provider === provider,
      )
      .take(1);
    return Observable.merge(updateActions, invalidationActions).takeUntil(
      removed,
    );
  });
}

/**
 * Applies fixes. This epic is only for side-effects, so it returns `Observable<empty>`.
 */
export function applyFix(
  actions: ActionsObservable<Action>,
  store: Store,
  extras: {messageRangeTracker: MessageRangeTracker},
): Observable<Action> {
  const {messageRangeTracker} = extras;

  // Map both type of "apply fix" actions to the same shape. This probably indicates that we don't
  // actually need two different action types.
  const messagesStream = Observable.merge(
    actions.ofType(Actions.APPLY_FIX).map(action => {
      invariant(action.type === Actions.APPLY_FIX);
      const {message} = action.payload;
      return [message];
    }),
    actions.ofType(Actions.APPLY_FIXES_FOR_FILE).map(action => {
      invariant(action.type === Actions.APPLY_FIXES_FOR_FILE);
      // TODO: Be consistent about file/filePath/path.
      const {file: filePath} = action.payload;
      return Selectors.getFileMessages(store.getState(), filePath);
    }),
  );

  return messagesStream
    .filter(messages => messages.length !== 0)
    .map(messages => {
      // We know that all of the messages have the same path based on the actions above, so just
      // grab it from the first message.
      const {filePath} = messages[0];
      invariant(filePath != null);

      // Get the fixes for each message.
      const messagesWithFixes = messages.filter(msg => msg.fix != null);
      const fixes: Array<TextEdit> = [];
      for (const message of messagesWithFixes) {
        const range = messageRangeTracker.getCurrentRange(message);
        if (range == null) {
          break;
        }
        fixes.push({...message.fix, oldRange: range});
      }

      const succeeded =
        messagesWithFixes.length === fixes.length &&
        applyTextEdits(filePath, ...fixes);
      if (succeeded) {
        return Actions.fixesApplied(filePath, new Set(messagesWithFixes));
      }
      return Actions.fixFailed();
    });
}

export function notifyOfFixFailures(
  actions: ActionsObservable<Action>,
): Observable<empty> {
  return actions
    .ofType(Actions.FIX_FAILED)
    .do(() => {
      atom.notifications.addWarning(
        'Failed to apply fix. Try saving to get fresh results and then try again.',
      );
    })
    .ignoreElements();
}

function forkJoinArray<T>(
  sources: Array<Observable<T> | Promise<T>>,
): Observable<Array<T>> {
  // $FlowFixMe: Needs a specialization for arrays
  return Observable.forkJoin(...sources);
}

export function fetchCodeActions(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  // TODO(hansonw): Until we have have a UI for it, only handle one request at a time.
  return actions.ofType(Actions.FETCH_CODE_ACTIONS).switchMap(action => {
    invariant(action.type === Actions.FETCH_CODE_ACTIONS);
    const {codeActionFetcher} = store.getState();
    if (codeActionFetcher == null) {
      return Observable.empty();
    }
    const {messages, editor} = action.payload;
    return forkJoinArray(
      messages.map(message =>
        Observable.defer(() =>
          codeActionFetcher.getCodeActionForDiagnostic(message, editor),
        )
          .switchMap(codeActions => {
            return codeActions.length === 0
              ? // forkJoin emits nothing for empty arrays.
                Observable.of([])
              : forkJoinArray(
                  // Eagerly fetch the titles so that they're immediately usable in a UI.
                  codeActions.map(async codeAction => [
                    await codeAction.getTitle(),
                    codeAction,
                  ]),
                );
          })
          .map(codeActions => [message, new Map(codeActions)]),
      ),
    )
      .map(codeActionsForMessage =>
        Actions.setCodeActions(new Map(codeActionsForMessage)),
      )
      .catch(err => {
        getLogger('atom-ide-diagnostics').error(
          `Error fetching code actions for ${messages[0].filePath}`,
          err,
        );
        return Observable.empty();
      });
  });
}
