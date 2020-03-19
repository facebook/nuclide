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
 * @emails oncall+nuclide
 */
import type {AppState, ConsoleSourceStatus} from '../lib/types';

import {ActionsObservable} from 'nuclide-commons/redux-observable';
import * as Actions from '../lib/redux/Actions';
import * as Epics from '../lib/redux/Epics';
import invariant from 'assert';
import {Observable, Subject} from 'rxjs';

describe('Epics', () => {
  describe('provideConsole (registerSourceEpic)', () => {
    it('observes the status', () => {
      const mockStore = {
        subscribe: () => () => {},
        dispatch: () => {},
        getState: () => (({}: any): AppState),
      };
      const id = 'test';
      const provider = {
        id,
        name: id,
        messages: Observable.never(),
        start: () => {},
        stop: () => {},
      };
      const actions = new ActionsObservable(
        Observable.of(Actions.registerSource(provider)),
      );
      let results = [];
      Epics.registerRecordProviderEpic(actions, mockStore).subscribe(
        results.push.bind(results),
      );
      const statusSubject = new Subject();
      const setStatus = (status: ConsoleSourceStatus): void => {
        statusSubject.next(Actions.updateStatus(id, status));
      };
      statusSubject.subscribe(results.push.bind(results));
      invariant(setStatus != null);
      setStatus('running');
      setStatus('stopped');
      setStatus('running');
      results = results.filter(action => action.type === Actions.UPDATE_STATUS);
      expect(results.length).toBe(3);
      expect(
        results.map(action => {
          invariant(action.type === Actions.UPDATE_STATUS);
          return action.payload.status;
        }),
      ).toEqual(['running', 'stopped', 'running']);
    });
  });
});
