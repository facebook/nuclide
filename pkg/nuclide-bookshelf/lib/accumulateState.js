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

import type {
  Action,
  AddProjectRepositoryAction,
  BookShelfRepositoryState,
  BookShelfState,
  CompleteRestoringRepositoryStateAction,
  RemoveProjectRepositoryAction,
  StartRestoringRepositoryStateAction,
  UpdatePaneItemStateAction,
  UpdateRepositoryBookmarksAction,
} from './types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {ActionType, EMPTY_SHORTHEAD} from './constants';
import Immutable from 'immutable';
import invariant from 'assert';

function getEmptyRepositoryState(): BookShelfRepositoryState {
  return {
    activeShortHead: EMPTY_SHORTHEAD,
    isRestoring: false,
    shortHeadsToFileList: Immutable.Map(),
  };
}

export function accumulateState(
  state: BookShelfState,
  action: Action,
): BookShelfState {
  switch (action.type) {
    case ActionType.ADD_PROJECT_REPOSITORY:
      return accumulateAddProjectRepository(state, action);

    case ActionType.REMOVE_PROJECT_REPOSITORY:
      return accumulateRemoveProjectRepository(state, action);

    case ActionType.UPDATE_PANE_ITEM_STATE:
      return accumulateUpdatePaneItemState(state, action);

    case ActionType.UPDATE_REPOSITORY_BOOKMARKS:
    case ActionType.START_RESTORING_REPOSITORY_STATE:
    case ActionType.COMPLETE_RESTORING_REPOSITORY_STATE:
      return accumulateRepositoryStateAction(state, action);

    default:
      return state;
  }
}

function accumulateAddProjectRepository(
  state: BookShelfState,
  action: AddProjectRepositoryAction,
): BookShelfState {
  const repositoryPath = action.payload.repository.getWorkingDirectory();
  const newRepositoryState =
    state.repositoryPathToState.get(repositoryPath) ||
    getEmptyRepositoryState();
  return {
    ...state,
    repositoryPathToState: state.repositoryPathToState.set(
      repositoryPath,
      newRepositoryState,
    ),
  };
}

function accumulateRemoveProjectRepository(
  state: BookShelfState,
  action: RemoveProjectRepositoryAction,
): BookShelfState {
  const repositoryPath = action.payload.repository.getWorkingDirectory();
  return {
    ...state,
    repositoryPathToState: state.repositoryPathToState.delete(repositoryPath),
  };
}

function accumulateRepositoryStateAction(
  state: BookShelfState,
  action:
    | UpdateRepositoryBookmarksAction
    | StartRestoringRepositoryStateAction
    | CompleteRestoringRepositoryStateAction,
): BookShelfState {
  const repositoryPath = action.payload.repository.getWorkingDirectory();

  const newRepositoryState = accumulateRepositoryState(
    state.repositoryPathToState.get(repositoryPath),
    action,
  );
  return {
    ...state,
    repositoryPathToState: state.repositoryPathToState.set(
      repositoryPath,
      newRepositoryState,
    ),
  };
}

function accumulateRepositoryState(
  repositoryState: ?BookShelfRepositoryState,
  action: Action,
): BookShelfRepositoryState {
  switch (action.type) {
    case ActionType.UPDATE_REPOSITORY_BOOKMARKS:
      return accumulateRepositoryStateUpdateBookmarks(repositoryState, action);
    case ActionType.START_RESTORING_REPOSITORY_STATE:
      invariant(
        repositoryState,
        'repository state not found when starting to restore!',
      );
      return {
        ...repositoryState,
        isRestoring: true,
      };
    case ActionType.COMPLETE_RESTORING_REPOSITORY_STATE:
      invariant(
        repositoryState,
        'repository state not found when starting to restore!',
      );
      return {
        ...repositoryState,
        isRestoring: false,
      };
    default:
      return repositoryState || getEmptyRepositoryState();
  }
}

function accumulateRepositoryStateUpdateBookmarks(
  repositoryState_: ?BookShelfRepositoryState,
  action: UpdateRepositoryBookmarksAction,
): BookShelfRepositoryState {
  let repositoryState = repositoryState_;

  repositoryState = repositoryState || getEmptyRepositoryState();
  const {bookmarkNames, activeShortHead} = action.payload;

  let {shortHeadsToFileList} = repositoryState;
  // Invalidate removed bookmarks data.
  for (const shortHead of repositoryState.shortHeadsToFileList.keys()) {
    if (!bookmarkNames.has(shortHead)) {
      shortHeadsToFileList = shortHeadsToFileList.delete(shortHead);
    }
  }

  return {
    ...repositoryState,
    activeShortHead,
    shortHeadsToFileList,
  };
}

function accumulateUpdatePaneItemState(
  state: BookShelfState,
  action: UpdatePaneItemStateAction,
): BookShelfState {
  const {repositoryPathToEditors} = action.payload;
  return {
    ...state,
    repositoryPathToState: Immutable.Map(
      Array.from(
        state.repositoryPathToState.entries(),
      ).map(([repositoryPath, repositoryState]) => {
        const fileList = (repositoryPathToEditors.get(repositoryPath) || []
        ).map(textEditor => textEditor.getPath() || '');
        return [
          repositoryPath,
          accumulateRepositoryStateUpdatePaneItemState(
            repositoryState,
            fileList,
          ),
        ];
      }),
    ),
  };
}

function accumulateRepositoryStateUpdatePaneItemState(
  repositoryState: BookShelfRepositoryState,
  fileList: Array<NuclideUri>,
): BookShelfRepositoryState {
  if (repositoryState.isRestoring) {
    return repositoryState;
  }
  return {
    ...repositoryState,
    shortHeadsToFileList: repositoryState.shortHeadsToFileList.set(
      repositoryState.activeShortHead,
      fileList,
    ),
  };
}
