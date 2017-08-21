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

// flowlint-next-line untyped-type-import:off
import type Immutable from 'immutable';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

export type BookShelfState = {
  repositoryPathToState: Immutable.Map<NuclideUri, BookShelfRepositoryState>,
};

export type SerializedBookShelfState = {
  repositoryPathToState: Array<[string, SerializedBookShelfRepositoryState]>,
};

export type BookShelfRepositoryState = {
  activeShortHead: string,
  isRestoring: boolean,
  shortHeadsToFileList: Immutable.Map<string, Array<NuclideUri>>,
};

export type SerializedBookShelfRepositoryState = {
  activeShortHead: string,
  shortHeadsToFileList: Array<[string, Array<string>]>,
};

export type RepositoryShortHeadChange = {
  repositoryPath: NuclideUri,
  activeShortHead: string,
};

export type ActiveShortHeadChangeBehaviorValue =
  | 'Always Ignore'
  | 'Always Restore'
  | 'Prompt to Restore';

export type ActionTypeValue =
  | 'add-project-repository'
  | 'complete-restoring-repository-state'
  | 'remove-project-repository'
  | 'restore-pane-item-state'
  | 'start-restoring-repository-state'
  | 'update-pane-item-state'
  | 'update-repository-bookmarks';

export type AddProjectRepositoryAction = {
  payload: {
    repository: atom$Repository,
  },
  type: 'add-project-repository',
};

export type UpdatePaneItemStateAction = {
  payload: {
    repositoryPathToEditors: Map<NuclideUri, Array<atom$TextEditor>>,
  },
  type: 'update-pane-item-state',
};

export type RemoveProjectRepositoryAction = {
  payload: {
    repository: atom$Repository,
  },
  type: 'remove-project-repository',
};

export type StartRestoringRepositoryStateAction = {
  payload: {
    repository: atom$Repository,
  },
  type: 'start-restoring-repository-state',
};

export type CompleteRestoringRepositoryStateAction = {
  payload: {
    repository: atom$Repository,
  },
  type: 'complete-restoring-repository-state',
};

export type RestorePaneItemStateAction = {
  payload: {
    repository: atom$Repository,
    shortHead: string,
  },
  type: 'restore-pane-item-state',
};

export type UpdateRepositoryBookmarksAction = {
  payload: {
    activeShortHead: string,
    bookmarkNames: Set<string>,
    repository: atom$Repository,
  },
  type: 'update-repository-bookmarks',
};

// Flow Issue: sorting alphabetically has a flow union issue.
export type Action =
  | UpdatePaneItemStateAction
  | RestorePaneItemStateAction
  | UpdateRepositoryBookmarksAction
  | StartRestoringRepositoryStateAction
  | CompleteRestoringRepositoryStateAction
  | AddProjectRepositoryAction
  | RemoveProjectRepositoryAction;
