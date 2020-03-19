/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {Action, BookShelfState} from './types';

import {ActionType} from './constants';
import {getRepoPathToEditors} from './utils';
import {track} from 'nuclide-analytics';

export class Commands {
  _dispatch: (action: Action) => void;
  _getState: () => BookShelfState;

  constructor(
    dispatch: (action: Action) => void,
    getState: () => BookShelfState,
  ) {
    this._dispatch = dispatch;
    this._getState = getState;
  }

  addProjectRepository = (repository: atom$Repository): void => {
    this._dispatch({
      payload: {
        repository,
      },
      type: ActionType.ADD_PROJECT_REPOSITORY,
    });
  };

  updatePaneItemState = (): void => {
    this._dispatch({
      type: ActionType.UPDATE_PANE_ITEM_STATE,
      payload: {
        repositoryPathToEditors: getRepoPathToEditors(),
      },
    });
  };

  restorePaneItemState = (
    repository: atom$Repository,
    newShortHead: string,
  ): void => {
    track('bookshelf-restore-files');
    this._dispatch({
      payload: {
        repository,
        shortHead: newShortHead,
      },
      type: ActionType.RESTORE_PANE_ITEM_STATE,
    });
  };
}
