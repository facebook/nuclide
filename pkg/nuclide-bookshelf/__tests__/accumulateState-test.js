/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import type {
  AddProjectRepositoryAction,
  BookShelfRepositoryState,
  BookShelfState,
  RemoveProjectRepositoryAction,
  UpdatePaneItemStateAction,
  UpdateRepositoryBookmarksAction,
} from '../lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {accumulateState} from '../lib/accumulateState';
import {ActionType, EMPTY_SHORTHEAD} from '../lib/constants';
import {getEmptBookShelfState} from '../lib/utils';
import nullthrows from 'nullthrows';
import * as Immutable from 'immutable';

describe('BookShelf accumulateState', () => {
  let fakeRepository: atom$Repository = (null: any);
  const REPO_PATH_1 = '/fake/path_1';
  const SHOTHEAD_1_1 = 'foo';
  const SHOTHEAD_1_2 = 'bar';
  const ACTIVE_SHOTHEAD_1 = SHOTHEAD_1_1;
  const REPO_STATE_1 = {
    activeShortHead: ACTIVE_SHOTHEAD_1,
    isRestoring: false,
    shortHeadsToFileList: Immutable.Map([
      [SHOTHEAD_1_1, ['c.txt', 'd.txt']],
      [SHOTHEAD_1_2, ['e.txt']],
    ]),
  };

  let emptyState: BookShelfState = (null: any);
  let oneRepoState: BookShelfState = (null: any);

  beforeEach(() => {
    fakeRepository = ({
      getWorkingDirectory: jest.fn().mockReturnValue(REPO_PATH_1),
    }: any);
    // a deepFreeze utility would have been better here.
    emptyState = Object.freeze(getEmptBookShelfState());

    oneRepoState = Object.freeze({
      repositoryPathToState: Immutable.Map([[REPO_PATH_1, REPO_STATE_1]]),
    });
  });

  describe('ADD_PROJECT_REPOSITORY', () => {
    it('adds an empty repository to the bookshelf state', () => {
      const addRepositoryAction: AddProjectRepositoryAction = {
        payload: {
          repository: fakeRepository,
        },
        type: ActionType.ADD_PROJECT_REPOSITORY,
      };
      const newState = accumulateState(emptyState, addRepositoryAction);
      expect(fakeRepository.getWorkingDirectory).toHaveBeenCalled();
      expect(emptyState.repositoryPathToState.size).toBe(0);
      expect(newState.repositoryPathToState.size).toBe(1);
      const addedRepoState: BookShelfRepositoryState = nullthrows(
        newState.repositoryPathToState.get(REPO_PATH_1),
      );
      expect(addedRepoState).toBeDefined();
      expect(addedRepoState.activeShortHead).toBe(EMPTY_SHORTHEAD);
      expect(addedRepoState.isRestoring).toBeFalsy();
      expect(addedRepoState.shortHeadsToFileList.size).toBe(0);
    });

    it("keeps the existing state when it's there", () => {
      expect(oneRepoState.repositoryPathToState.size).toBe(1);
      const addRepositoryAction: AddProjectRepositoryAction = {
        payload: {
          repository: fakeRepository,
        },
        type: ActionType.ADD_PROJECT_REPOSITORY,
      };
      const newState = accumulateState(oneRepoState, addRepositoryAction);
      expect(fakeRepository.getWorkingDirectory).toHaveBeenCalled();
      expect(newState.repositoryPathToState.size).toBe(1);
      const keptRepoState: BookShelfRepositoryState = nullthrows(
        newState.repositoryPathToState.get(REPO_PATH_1),
      );
      expect(keptRepoState).toBeDefined();
      expect(keptRepoState.activeShortHead).toBe(ACTIVE_SHOTHEAD_1);
      expect(keptRepoState.isRestoring).toBeFalsy();
      expect(keptRepoState.shortHeadsToFileList.size).toBe(2);
      expect(keptRepoState.shortHeadsToFileList.get(SHOTHEAD_1_1)).toEqual([
        'c.txt',
        'd.txt',
      ]);
      expect(keptRepoState.shortHeadsToFileList.get(SHOTHEAD_1_2)).toEqual([
        'e.txt',
      ]);
    });
  });

  describe('REMOVE_PROJECT_REPOSITORY', () => {
    it('removes the managed state of the repository', () => {
      expect(oneRepoState.repositoryPathToState.size).toBe(1);
      const removeRepositoryAction: RemoveProjectRepositoryAction = {
        payload: {
          repository: fakeRepository,
        },
        type: ActionType.REMOVE_PROJECT_REPOSITORY,
      };
      const newState = accumulateState(emptyState, removeRepositoryAction);
      expect(fakeRepository.getWorkingDirectory).toHaveBeenCalled();
      expect(oneRepoState.repositoryPathToState.size).toBe(1);
      expect(newState.repositoryPathToState.size).toBe(0);
    });

    it('no-op when no existing tracked state', () => {
      const removeRepositoryAction: RemoveProjectRepositoryAction = {
        payload: {
          repository: fakeRepository,
        },
        type: ActionType.REMOVE_PROJECT_REPOSITORY,
      };
      const newState = accumulateState(emptyState, removeRepositoryAction);
      expect(fakeRepository.getWorkingDirectory).toHaveBeenCalled();
      expect(newState.repositoryPathToState).toBe(
        emptyState.repositoryPathToState,
      );
    });
  });

  describe('UPDATE_REPOSITORY_BOOKMARKS', () => {
    it('creates a repository with bookmark state, if no one exists', () => {
      const updateBookmarksAction: UpdateRepositoryBookmarksAction = {
        payload: {
          repository: fakeRepository,
          bookmarkNames: new Set(['a', 'b', 'c']),
          activeShortHead: 'a',
        },
        type: ActionType.UPDATE_REPOSITORY_BOOKMARKS,
      };
      const newState = accumulateState(emptyState, updateBookmarksAction);
      expect(emptyState.repositoryPathToState.size).toBe(0);
      expect(newState.repositoryPathToState.size).toBe(1);
      const newRepositoryState: BookShelfRepositoryState = nullthrows(
        newState.repositoryPathToState.get(REPO_PATH_1),
      );
      expect(newRepositoryState.activeShortHead).toBe('a');
      expect(newRepositoryState.isRestoring).toBe(false);
      expect(newRepositoryState.shortHeadsToFileList.size).toBe(0);
    });

    it('removes old cached short head data when its bookmarks are gone', () => {
      const updateBookmarksAction: UpdateRepositoryBookmarksAction = {
        payload: {
          repository: fakeRepository,
          bookmarkNames: new Set([SHOTHEAD_1_2]),
          activeShortHead: SHOTHEAD_1_2,
        },
        type: ActionType.UPDATE_REPOSITORY_BOOKMARKS,
      };
      const oldRpositoryState = oneRepoState.repositoryPathToState.get(
        REPO_PATH_1,
      );
      expect(nullthrows(oldRpositoryState).shortHeadsToFileList.size).toBe(2);
      expect(
        nullthrows(oldRpositoryState).shortHeadsToFileList.has(SHOTHEAD_1_1),
      ).toBeTruthy();

      const newState = accumulateState(oneRepoState, updateBookmarksAction);
      expect(newState.repositoryPathToState.size).toBe(1);

      const newRepositoryState: BookShelfRepositoryState = nullthrows(
        newState.repositoryPathToState.get(REPO_PATH_1),
      );
      expect(newRepositoryState.activeShortHead).toBe(SHOTHEAD_1_2);
      expect(newRepositoryState.isRestoring).toBe(false);
      expect(newRepositoryState.shortHeadsToFileList.size).toBe(1);
      expect(
        newRepositoryState.shortHeadsToFileList.has(SHOTHEAD_1_1),
      ).toBeFalsy();
      expect(newRepositoryState.shortHeadsToFileList.get(SHOTHEAD_1_2)).toEqual(
        nullthrows(oldRpositoryState).shortHeadsToFileList.get(SHOTHEAD_1_2),
      );
    });
  });

  describe('UDATE_PANE_ITEM_STATE', () => {
    const OTHER_REPO_PARH = '/another/repo/path';
    let fakeEditor1: atom$TextEditor = (null: any);
    let fakeEditor2: atom$TextEditor = (null: any);
    let fakeEditor3: atom$TextEditor = (null: any);

    function createFakeEditor(editorPath: NuclideUri): atom$TextEditor {
      // $FlowFixMe
      return {
        getPath: jest.fn().mockReturnValue(editorPath),
      };
    }

    beforeEach(() => {
      fakeEditor1 = createFakeEditor('file1.txt');
      fakeEditor2 = createFakeEditor('file2.txt');
      fakeEditor3 = createFakeEditor('file3.txt');
    });

    it('updates the tracked repos states with the new pane item state', () => {
      const updatePaneItemAction: UpdatePaneItemStateAction = {
        payload: {
          repositoryPathToEditors: new Map([
            [REPO_PATH_1, [fakeEditor1, fakeEditor2]],
            [OTHER_REPO_PARH, [fakeEditor3]],
          ]),
        },
        type: ActionType.UPDATE_PANE_ITEM_STATE,
      };
      const newState = accumulateState(oneRepoState, updatePaneItemAction);

      const oldShortHeadsToFileList = nullthrows(
        oneRepoState.repositoryPathToState.get(REPO_PATH_1),
      ).shortHeadsToFileList;
      expect(oldShortHeadsToFileList.size).toBe(2);
      expect(oldShortHeadsToFileList.get(SHOTHEAD_1_1)).toEqual([
        'c.txt',
        'd.txt',
      ]);

      // Doesn't add untracked repos.
      expect(newState.repositoryPathToState.size).toBe(1);

      const newShortHeadsToFileList = nullthrows(
        newState.repositoryPathToState.get(REPO_PATH_1),
      ).shortHeadsToFileList;
      expect(newShortHeadsToFileList.size).toBe(2);
      expect(newShortHeadsToFileList.get(SHOTHEAD_1_1)).toEqual([
        'file1.txt',
        'file2.txt',
      ]);
      expect(newShortHeadsToFileList.get(SHOTHEAD_1_2)).toEqual(['e.txt']);
    });
  });
});
