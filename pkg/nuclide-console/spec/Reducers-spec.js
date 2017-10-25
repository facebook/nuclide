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

import type {Action, Executor} from '../lib/types';

import * as Actions from '../lib/redux/Actions';
import Reducers from '../lib/redux/Reducers';
import {Observable} from 'rxjs';

const emptyAppState = {
  createPasteFunction: null,
  currentExecutorId: null,
  maxMessageCount: Number.POSITIVE_INFINITY,
  executors: new Map(),
  providers: new Map(),
  providerStatuses: new Map(),
  providerSubscriptions: new Map(),
  records: [],
  history: [],
};

describe('createStateStream', () => {
  describe('RECORD_RECEIVED', () => {
    let finalState;
    let initialRecords;

    beforeEach(() => {
      initialRecords = [];
      const initialState = {
        ...emptyAppState,
        maxMessageCount: 2,
        records: initialRecords,
      };
      const actions = [];
      for (let i = 0; i < 5; i++) {
        actions.push({
          type: Actions.RECORD_RECEIVED,
          payload: {
            record: {
              level: 'info',
              text: i.toString(),
            },
          },
        });
      }
      finalState = ((actions: any): Array<Action>).reduce(
        Reducers,
        initialState,
      );
    });

    it('adds records', () => {
      expect(finalState.records.length).toBeGreaterThan(0);
    });

    it('truncates the record list using `maxMessageCount`', () => {
      expect(finalState.records.length).toBe(2);
    });

    it('truncates the least recent records', () => {
      expect(finalState.records.map(record => record.text)).toEqual(['3', '4']);
    });

    it("doesn't mutate the original records list", () => {
      expect(initialRecords.length).toBe(0);
    });
  });

  describe('REGISTER_SOURCE', () => {
    let initialProviders;
    let finalState;

    beforeEach(() => {
      initialProviders = new Map();
      const initialState = {
        ...emptyAppState,
        providers: initialProviders,
      };
      const actions = [
        {
          type: Actions.REGISTER_SOURCE,
          payload: {
            source: {
              id: 'test',
              records: Observable.empty(),
            },
          },
        },
      ];
      finalState = ((actions: any): Array<Action>).reduce(
        Reducers,
        initialState,
      );
    });

    it('adds providers to the registry', () => {
      expect(finalState.providers.size).toBe(1);
    });

    it("doesn't mutate the original provider map", () => {
      expect(initialProviders.size).toBe(0);
    });
  });

  describe('CLEAR_RECORDS', () => {
    let initialRecords;
    let finalState;

    beforeEach(() => {
      initialRecords = [
        {
          kind: 'message',
          sourceId: 'Test',
          level: 'info',
          text: 'test',
          scopeName: null,
          timestamp: new Date('2017-01-01T12:34:56.789Z'),
          data: null,
          repeatCount: 1,
        },
      ];
      const initialState = {
        ...emptyAppState,
        records: initialRecords,
      };
      const actions = [{type: Actions.CLEAR_RECORDS}];
      finalState = actions.reduce(Reducers, initialState);
    });

    it('clears the records', () => {
      expect(finalState.records.length).toBe(0);
    });

    it("doesn't mutate the original records list", () => {
      expect(initialRecords.length).toBe(1);
    });
  });

  describe('executor registration', () => {
    let dummyExecutor;
    let initialExecutors;
    let initialState;
    let finalState;

    beforeEach(() => {
      dummyExecutor = createDummyExecutor('a');
      initialExecutors = new Map([['a', dummyExecutor]]);
      initialState = {
        ...emptyAppState,
        executors: initialExecutors,
      };
    });

    describe('REGISTER_EXECUTOR', () => {
      beforeEach(() => {
        const actions = [
          {
            type: Actions.REGISTER_EXECUTOR,
            payload: {
              executor: createDummyExecutor('b'),
            },
          },
        ];
        finalState = actions.reduce(Reducers, initialState);
      });

      it('adds an executor', () => {
        expect(finalState.executors.size).toBe(2);
      });

      it("doesn't mutate the original executor map", () => {
        expect(initialExecutors.size).toBe(1);
      });
    });

    describe('unregisterExecutor', () => {
      beforeEach(() => {
        const actions = [Actions.unregisterExecutor(dummyExecutor)];
        finalState = actions.reduce(Reducers, initialState);
      });

      it('removes an executor', () => {
        expect(finalState.executors.size).toBe(0);
      });

      it("doesn't mutate the original executor map", () => {
        expect(initialExecutors.size).toBe(1);
      });
    });
  });
});

function createDummyExecutor(id: string): Executor {
  return {
    id,
    name: id,
    send: (code: string) => {},
    output: Observable.create(observer => {}),
  };
}
