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

import type {AppState} from '../lib/types';

import {ActionsObservable} from 'nuclide-commons/redux-observable';
import * as Actions from '../lib/redux/Actions';
import * as Epics from '../lib/redux/Epics';
import invariant from 'assert';
import {Observable} from 'rxjs';

describe('Epics', () => {
  describe('registerOutputProviderEpic', () => {
    it('observes the status', () => {
      const mockStore = {
        dispatch: () => {},
        getState: () => (({}: any): AppState),
      };
      let setStatus;
      const provider = {
        id: 'test',
        messages: Observable.never(),
        observeStatus: cb => {
          setStatus = cb;
        },
        start: () => {},
        stop: () => {},
      };
      const actions = new ActionsObservable(
        Observable.of(Actions.registerOutputProvider(provider)),
      );
      let results = [];
      Epics.registerRecordProviderEpic(actions, mockStore).subscribe(
        results.push.bind(results),
      );
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
