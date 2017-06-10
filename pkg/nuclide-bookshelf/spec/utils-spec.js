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

import type {RepositoryShortHeadChange} from '../lib/types';

import {
  getDummyBookShelfState,
  REPO_PATH_1 as DUMMY_REPO_PATH_1,
} from './dummy';
import {
  deserializeBookShelfState,
  getEmptBookShelfState,
  getShortHeadChangesFromStateStream,
  serializeBookShelfState,
} from '../lib/utils';
import Immutable from 'immutable';
import {Subject} from 'rxjs';

describe('BookShelf Utils', () => {
  describe('serialize/deserialize', () => {
    const REPO_PATH_1 = '/fake/path_1';
    const SHOTHEAD_1_1 = 'FOO';
    const ACTIVE_SHOTHEAD_1 = '';
    const REPO_STATE_1 = {
      activeShortHead: ACTIVE_SHOTHEAD_1,
      isRestoring: false,
      shortHeadsToFileList: Immutable.Map([[SHOTHEAD_1_1, ['a.txt', 'b.txt']]]),
    };

    const REPO_PATH_2 = '/fake/path_2';
    const SHOTHEAD_2_1 = 'bar';
    const SHOTHEAD_2_2 = 'baz';
    const ACTIVE_SHOTHEAD_2 = 'baz';
    const REPO_STATE_2 = {
      activeShortHead: ACTIVE_SHOTHEAD_2,
      isRestoring: false,
      shortHeadsToFileList: Immutable.Map([
        [SHOTHEAD_2_1, ['c.txt', 'd.txt']],
        [SHOTHEAD_2_2, ['e.txt']],
      ]),
    };

    describe('serializeBookShelfState', () => {
      it('serializes an empty state', () => {
        const serialized = serializeBookShelfState(getEmptBookShelfState());
        expect(serialized.repositoryPathToState.length).toBe(0);
      });

      it('serializes bookshelf state maps to entries pais', () => {
        const serialized = serializeBookShelfState({
          repositoryPathToState: Immutable.Map([
            [REPO_PATH_1, REPO_STATE_1],
            [REPO_PATH_2, REPO_STATE_2],
          ]),
        });
        expect(serialized.repositoryPathToState.length).toBe(2);
        const serializedRepoState1 = serialized.repositoryPathToState[0];
        expect(serializedRepoState1.length).toBe(2);
        expect(serializedRepoState1[0]).toBe(REPO_PATH_1);
        expect(serializedRepoState1[1].activeShortHead).toBe(ACTIVE_SHOTHEAD_1);
        expect((serializedRepoState1[1]: any).isRestoring).toBeUndefined();
        expect(serializedRepoState1[1].shortHeadsToFileList.length).toBe(1);
        expect(serializedRepoState1[1].shortHeadsToFileList[0][0]).toBe(
          SHOTHEAD_1_1,
        );
        expect(
          serializedRepoState1[1].shortHeadsToFileList[0][1].join(','),
        ).toBe(['a.txt', 'b.txt'].join(','));

        const serializedRepoState2 = serialized.repositoryPathToState[1];
        expect(serializedRepoState2.length).toBe(2);
        expect(serializedRepoState2[0]).toBe(REPO_PATH_2);
        expect(serializedRepoState2[1].shortHeadsToFileList.length).toBe(2);
      });

      it('serializing an invalid bookshelf state throws', () => {
        expect(() => serializeBookShelfState(({}: any))).toThrow();
      });
    });

    describe('deserializeBookShelfState', () => {
      it('dserializes null to an empty state', () => {
        const deserialized = deserializeBookShelfState(null);
        expect(deserialized.repositoryPathToState.size).toBe(0);
      });

      it('dserializes one repository state', () => {
        const deserialized = deserializeBookShelfState({
          repositoryPathToState: [
            [
              REPO_PATH_1,
              {
                ...REPO_STATE_1,
                shortHeadsToFileList: Array.from(
                  REPO_STATE_1.shortHeadsToFileList.entries(),
                ),
              },
            ],
          ],
        });
        expect(deserialized.repositoryPathToState.size).toBe(1);
        const deserializedRepoState = deserialized.repositoryPathToState.get(
          REPO_PATH_1,
        );
        expect(deserializedRepoState).not.toBeNull();
        expect(deserializedRepoState.activeShortHead).toBe(ACTIVE_SHOTHEAD_1);
        expect(deserializedRepoState.isRestoring).toBe(false);
        expect(deserializedRepoState.shortHeadsToFileList.size).toBe(1);
        expect(
          deserializedRepoState.shortHeadsToFileList
            .get(SHOTHEAD_1_1)
            .join(','),
        ).toBe(['a.txt', 'b.txt'].join(','));
      });

      it('dserializes two repository states', () => {
        const deserialized = deserializeBookShelfState({
          repositoryPathToState: [
            [
              REPO_PATH_1,
              {
                ...REPO_STATE_1,
                shortHeadsToFileList: Array.from(
                  REPO_STATE_1.shortHeadsToFileList.entries(),
                ),
              },
            ],
            [
              REPO_PATH_2,
              {
                ...REPO_STATE_2,
                shortHeadsToFileList: Array.from(
                  REPO_STATE_2.shortHeadsToFileList.entries(),
                ),
              },
            ],
          ],
        });
        expect(deserialized.repositoryPathToState.size).toBe(2);
        const deserializedRepoState1 = deserialized.repositoryPathToState.get(
          REPO_PATH_1,
        );
        expect(deserializedRepoState1).not.toBeNull();
        expect(deserializedRepoState1.activeShortHead).toBe(ACTIVE_SHOTHEAD_1);
        expect(deserializedRepoState1.isRestoring).toBe(false);
        expect(deserializedRepoState1.shortHeadsToFileList.size).toBe(1);
        expect(
          deserializedRepoState1.shortHeadsToFileList
            .get(SHOTHEAD_1_1)
            .join(','),
        ).toBe(['a.txt', 'b.txt'].join(','));

        const deserializedRepoState2 = deserialized.repositoryPathToState.get(
          REPO_PATH_2,
        );
        expect(deserializedRepoState2).not.toBeNull();
        expect(deserializedRepoState2.activeShortHead).toBe(ACTIVE_SHOTHEAD_2);
        expect(deserializedRepoState2.isRestoring).toBe(false);
        expect(deserializedRepoState2.shortHeadsToFileList.size).toBe(2);
        expect(
          deserializedRepoState2.shortHeadsToFileList
            .get(SHOTHEAD_2_1)
            .join(','),
        ).toBe(['c.txt', 'd.txt'].join(','));
        expect(
          deserializedRepoState2.shortHeadsToFileList
            .get(SHOTHEAD_2_2)
            .join(','),
        ).toBe('e.txt');
      });

      it('deserializing an invalid state throws an exception', () => {
        expect(() =>
          deserializeBookShelfState(({repositoryPathToState: 123}: any)),
        ).toThrow();
      });
    });
  });

  describe('getShortHeadChangesFromStateStream', () => {
    const states = new Subject();
    const shortHeadChangesStream = getShortHeadChangesFromStateStream(states);

    const shortHeadChanges: Array<RepositoryShortHeadChange> = [];
    shortHeadChangesStream.subscribe(change => shortHeadChanges.push(change));

    states.next(getDummyBookShelfState());

    const newActiveShortHead = 'foo_bar';
    const newStateWithShortHeadChange = getDummyBookShelfState();
    const newRepositoryState = newStateWithShortHeadChange.repositoryPathToState.get(
      DUMMY_REPO_PATH_1,
    );
    newRepositoryState.activeShortHead = newActiveShortHead;

    states.next(newStateWithShortHeadChange);
    states.complete();

    waitsFor(() => shortHeadChanges.length === 1);

    runs(() => {
      const {repositoryPath, activeShortHead} = shortHeadChanges[0];
      expect(repositoryPath).toBe(DUMMY_REPO_PATH_1);
      expect(activeShortHead).toBe(newActiveShortHead);
    });
  });
});
