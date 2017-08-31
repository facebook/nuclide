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

import type {FileDiagnosticMessage} from '../lib/types';

import {Observable} from 'rxjs';
import {ActionsObservable} from 'nuclide-commons/redux-observable';
import * as Actions from '../lib/redux/Actions';
import {fetchCodeActions} from '../lib/redux/Epics';
import createStore from '../lib/redux/createStore';

describe('Epics', () => {
  describe('fetchCodeActions', () => {
    const fakeMessageRangeTracker: any = null;
    const fakeEditor: atom$TextEditor = (null: any);
    const TEST_ACTION = {
      async apply() {},
      dispose() {},
      getTitle: () => Promise.resolve('test'),
    };
    const TEST_DIAGNOSTIC = {};
    const fakeMessages: Array<FileDiagnosticMessage> = ([
      TEST_DIAGNOSTIC,
      {},
    ]: any);

    it('fetches code actions for a set of diagnostics', () => {
      const store = createStore(fakeMessageRangeTracker);
      store.dispatch(
        Actions.setCodeActionFetcher({
          async getCodeActionForDiagnostic(editor, message) {
            if (message === TEST_DIAGNOSTIC) {
              return [TEST_ACTION];
            }
            return [];
          },
        }),
      );

      waitsForPromise(async () => {
        expect(
          await fetchCodeActions(
            new ActionsObservable(
              Observable.of(Actions.fetchCodeActions(fakeEditor, fakeMessages)),
            ),
            store,
          )
            .toArray()
            .toPromise(),
        ).toEqual([
          Actions.setCodeActions(
            new Map([
              [fakeMessages[0], new Map([['test', TEST_ACTION]])],
              [fakeMessages[1], new Map()],
            ]),
          ),
        ]);
      });
    });
  });
});
