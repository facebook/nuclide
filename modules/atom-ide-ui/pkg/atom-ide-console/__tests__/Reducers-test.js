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
import type {Action, Executor, AppState} from '../lib/types';

import invariant from 'assert';
import * as Actions from '../lib/redux/Actions';
import Reducers from '../lib/redux/Reducers';
import * as Immutable from 'immutable';
import uuid from 'uuid';
import {Observable} from 'rxjs';

const emptyAppState = {
  createPasteFunction: null,
  currentExecutorId: null,
  maxMessageCount: Number.POSITIVE_INFINITY,
  executors: new Map(),
  providers: new Map(),
  providerStatuses: new Map(),
  records: Immutable.List(),
  incompleteRecords: Immutable.List(),
  history: [],
};

describe('createStateStream', () => {
  describe('RECORD_RECEIVED', () => {
    let finalState;
    let initialRecords;

    beforeEach(() => {
      initialRecords = Immutable.List();
      const initialState: AppState = {
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
      expect(finalState.records.size).toBeGreaterThan(0);
    });

    it('truncates the record list using `maxMessageCount`', () => {
      expect(finalState.records.size).toBe(2);
    });

    it('truncates the least recent records', () => {
      expect(finalState.records.map(record => record.text).toArray()).toEqual([
        '3',
        '4',
      ]);
    });

    it("doesn't mutate the original records list", () => {
      expect(initialRecords.size).toBe(0);
    });
  });

  describe('RECORD_UPDATED', () => {
    let finalState: AppState;
    let initialRecords;
    let messageIds: Array<string> = [];

    beforeEach(() => {
      messageIds = [];
      initialRecords = Immutable.List();
      const initialState = {
        ...emptyAppState,
        maxMessageCount: 2,
        records: initialRecords,
      };
      const actions = [];
      for (let i = 0; i < 2; i++) {
        messageIds[i] = uuid.v4();

        actions.push({
          type: Actions.RECORD_RECEIVED,
          payload: {
            record: {
              level: 'info',
              text: i.toString(),
              incomplete: true,
              messageId: messageIds[i],
            },
          },
        });
      }

      // Check that appending updates the text on the correct record
      // and doesn't modify others.
      actions.push({
        type: Actions.RECORD_UPDATED,
        payload: {
          messageId: messageIds[0],
          appendText: '!',
          overrideLevel: 'warning',
          setComplete: false,
        },
      });

      // Appending twice updates the record correctly.
      actions.push({
        type: Actions.RECORD_UPDATED,
        payload: {
          messageId: messageIds[0],
          appendText: '!',
          overrideLevel: 'warning',
          setComplete: false,
        },
      });

      finalState = ((actions: any): Array<Action>).reduce(
        Reducers,
        initialState,
      );
    });

    it('Updates incomplete records test and level correctly', () => {
      expect(finalState.records.size).toBe(0);
      expect(finalState.incompleteRecords.size).toBe(2);
      const message0 = finalState.incompleteRecords.get(0);
      invariant(message0 != null);
      expect(message0.messageId).toBe(messageIds[0]);
      expect(message0.text).toBe('0!!');
      expect(message0.level).toBe('warning');
      expect(message0.incomplete).toBe(true);

      // Message 1 was not mutated.
      const message1 = finalState.incompleteRecords.get(1);
      invariant(message1 != null);
      expect(message1.messageId).toBe(messageIds[1]);
      expect(message1.text).toBe('1');
      expect(message1.level).toBe('info');
      expect(message1.incomplete).toBe(true);
    });

    it('Completes the records', () => {
      let newState = ([
        {
          type: Actions.RECORD_UPDATED,
          payload: {
            messageId: messageIds[0],
            appendText: null,
            overrideLevel: null,
            setComplete: true,
          },
        },
      ]: Array<Action>).reduce(Reducers, finalState);
      let message0 = newState.records.get(0);
      let message1 = newState.incompleteRecords.get(0);

      const verify = () => {
        expect(newState.records.size).toBe(1);
        expect(newState.incompleteRecords.size).toBe(1);

        invariant(message0 != null);
        expect(message0.messageId).toBe(messageIds[0]);
        expect(message0.text).toBe('0!!');
        expect(message0.level).toBe('warning');
        expect(message0.incomplete).toBe(false);

        invariant(message1 != null);
        expect(message1.messageId).toBe(messageIds[1]);
        expect(message1.text).toBe('1');
        expect(message1.level).toBe('info');
        expect(message1.incomplete).toBe(true);
      };

      verify();

      // Attempting to update a completed message throws and doesn't
      // change the state.
      let thrown = false;
      try {
        newState = ([
          {
            type: Actions.RECORD_UPDATED,
            payload: {
              messageId: messageIds[0],
              appendText: '!',
              overrideLevel: null,
              setComplete: true,
            },
          },
        ]: Array<Action>).reduce(Reducers, newState);
      } catch (_) {
        thrown = true;
      }
      expect(thrown).toBe(true);
      message0 = newState.records.get(0);
      message1 = newState.incompleteRecords.get(0);
      verify();
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
      initialRecords = Immutable.List([
        {
          kind: 'message',
          sourceId: 'test-source',
          sourceName: 'Test',
          level: 'info',
          text: 'test',
          scopeName: null,
          timestamp: new Date('2017-01-01T12:34:56.789Z'),
          repeatCount: 1,
          incomplete: false,
        },
      ]);
      const initialState = {
        ...emptyAppState,
        records: initialRecords,
      };
      const actions = [{type: Actions.CLEAR_RECORDS}];
      finalState = actions.reduce(Reducers, initialState);
    });

    it('clears the records', () => {
      expect(finalState.records.size).toBe(0);
    });

    it("doesn't mutate the original records list", () => {
      expect(initialRecords.size).toBe(1);
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

export function createDummyExecutor(id: string): Executor {
  return {
    id,
    name: id,
    scopeName: () => 'text.plain',
    send: (code: string) => {},
    output: Observable.create(observer => {}),
  };
}
