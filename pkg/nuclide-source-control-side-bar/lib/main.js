'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {
  Action,
  SetBookmarkIsLoading,
  UnsetBookmarkIsLoading,
  UpdateUncommittedChanges,
} from './types';
import type {BookmarkInfo} from '../../nuclide-hg-rpc/lib/HgService';
import type {NuclideSideBarService} from '../../nuclide-side-bar';
import type {Observable} from 'rxjs';
import type {FileChangeStatusValue} from '../../nuclide-hg-git-bridge/lib/constants';
import type {NuclideUri} from '../../commons-node/NuclideUri';

import * as ActionType from './ActionType';
import {applyActionMiddleware} from './applyActionMiddleware';
import {bindObservableAsProps} from '../../nuclide-ui/bindObservableAsProps';
import bookmarkIsEqual from './bookmarkIsEqual';
import Commands from './Commands';
import {Disposable} from 'atom';
import UniversalDisposable from '../../commons-node/UniversalDisposable';
import {observableFromSubscribeFunction} from '../../commons-node/event';
import {BehaviorSubject, Subject} from 'rxjs';
import SideBarComponent from './SideBarComponent';
import {track} from '../../nuclide-analytics';
import {getDirtyFileChanges} from '../../commons-node/vcs';

export type AppState = {
  uncommittedChanges: Map<NuclideUri, Map<NuclideUri, FileChangeStatusValue>>,
  projectBookmarks: Map<string, Array<BookmarkInfo>>,
  projectDirectories: Array<atom$Directory>,
  projectRepositories: Map<string, atom$Repository>,
  repositoryBookmarksIsLoading: WeakMap<atom$Repository, Array<BookmarkInfo>>,
};

function createStateStream(
  actions: Observable<Action>,
  initialState: AppState,
): BehaviorSubject<AppState> {
  const states = new BehaviorSubject(initialState);
  actions.scan(accumulateState, initialState).subscribe(states);
  return states;
}

function getInitialState() {
  return {
    uncommittedChanges: new Map(),
    projectBookmarks: new Map(),
    projectDirectories: [],
    projectRepositories: new Map(),
    repositoryBookmarksIsLoading: new WeakMap(),
  };
}

let commands: Commands;
let disposables: UniversalDisposable;
let states: BehaviorSubject<AppState>;

export function activate(rawState: Object): void {
  const initialState = getInitialState();
  const actions = new Subject();
  states = createStateStream(
    applyActionMiddleware(actions, () => states.getValue()),
    initialState,
  );

  const dispatch = action => { actions.next(action); };
  commands = new Commands(dispatch, () => states.getValue());

  const subscription = observableFromSubscribeFunction(
      atom.project.onDidChangePaths.bind(atom.project),
    )
    .startWith(null) // Start with a fake event to fetch initial directories.
    .subscribe(() => {
      commands.fetchProjectDirectories();
    });

  disposables = new UniversalDisposable(subscription);
}

export function consumeNuclideSideBar(sideBar: NuclideSideBarService): IDisposable {
  let serviceDisposable;

  sideBar.registerView({
    getComponent() {
      const props = states.map(state => ({
        createBookmark: commands.createBookmark,
        deleteBookmark: commands.deleteBookmark,
        projectBookmarks: state.projectBookmarks,
        projectDirectories: state.projectDirectories,
        projectRepositories: state.projectRepositories,
        renameBookmark: commands.renameBookmark,
        repositoryBookmarksIsLoading: state.repositoryBookmarksIsLoading,
        updateToBookmark: commands.updateToBookmark,
        uncommittedChanges: state.uncommittedChanges,
      }));

      track('scsidebar-show');
      return bindObservableAsProps(props, SideBarComponent);
    },
    onDidShow() {},
    title: 'Source Control',
    toggleCommand: 'nuclide-source-control-side-bar:toggle',
    viewId: 'nuclide-source-control-side-bar',
  });

  serviceDisposable = new Disposable(() => {
    sideBar.destroyView('nuclide-source-control-side-bar');
  });
  disposables.add(serviceDisposable);

  return new Disposable(() => {
    if (serviceDisposable != null) {
      disposables.remove(serviceDisposable);
      serviceDisposable = null;
    }
  });
}

function accumulateSetBookmarkIsLoading(state: AppState, action: SetBookmarkIsLoading): AppState {
  const {
    bookmark,
    repository,
  } = action.payload;
  let repositoryBookmarksIsLoading;
  if (state.repositoryBookmarksIsLoading.has(repository)) {
    repositoryBookmarksIsLoading = state.repositoryBookmarksIsLoading.get(repository);
  } else {
    repositoryBookmarksIsLoading = [];
  }

  const bookmarkIndex = repositoryBookmarksIsLoading.findIndex(
    loadingBookmark => bookmarkIsEqual(loadingBookmark, bookmark));
  if (bookmarkIndex === -1) {
    repositoryBookmarksIsLoading.push(bookmark);
  }

  return {
    ...state,
    repositoryBookmarksIsLoading:
      state.repositoryBookmarksIsLoading.set(repository, repositoryBookmarksIsLoading),
  };
}

function accumulateRepositoriesUncommittedChanges(
  state: AppState,
  action: UpdateUncommittedChanges,
): AppState {
  const {
    directory,
    repository,
  } = action.payload;

  if (repository.getType() === 'hg') {
    const uncommittedChanges = getDirtyFileChanges(repository);
    const filteredUncommitedChangesMap = new Map();
    // The get dirty file changes gets changes for the whole repository and
    // for most part only a directory in the repository is imported. This filter
    // will show only the related files under each directory.
    for (const [filePath, fileStatus] of uncommittedChanges.entries()) {
      if (filePath.startsWith(directory.getPath())) {
        filteredUncommitedChangesMap.set(filePath, fileStatus);
      }
    }
    return {
      ...state,
      uncommittedChanges:
        new Map(state.uncommittedChanges).set(
          directory.getPath(),
          filteredUncommitedChangesMap,
        ),
    };
  }

  return state;
}

function accumulateUnsetBookmarkIsLoading(
  state: AppState,
  action: UnsetBookmarkIsLoading,
): AppState {
  const {
    bookmark,
    repository,
  } = action.payload;
  const repositoryBookmarksIsLoading = state.repositoryBookmarksIsLoading.get(repository);
  if (repositoryBookmarksIsLoading == null) {
    // TODO: Can this happen?
    return state;
  }

  const bookmarkIndex = repositoryBookmarksIsLoading.findIndex(
    loadingBookmark => bookmarkIsEqual(loadingBookmark, bookmark));
  if (bookmarkIndex >= 0) {
    repositoryBookmarksIsLoading.splice(bookmarkIndex, 1);
  }

  return state;
}

function accumulateState(state: AppState, action: Action): AppState {
  switch (action.type) {
    case ActionType.UPDATE_UNCOMMITTED_CHANGES:
      return accumulateRepositoriesUncommittedChanges(state, action);
    case ActionType.SET_BOOKMARK_IS_LOADING:
      return accumulateSetBookmarkIsLoading(state, action);
    case ActionType.UNSET_BOOKMARK_IS_LOADING:
      return accumulateUnsetBookmarkIsLoading(state, action);
    case ActionType.SET_DIRECTORY_REPOSITORY:
      return {
        ...state,
        projectRepositories: state.projectRepositories.set(
          action.payload.directory.getPath(),
          action.payload.repository,
        ),
      };
    case ActionType.SET_PROJECT_DIRECTORIES:
      // This event is the state of the world coming from Atom. If directories no longer exist,
      // their other stored states should be wiped out to prevent holding references to old data.
      // Copy only the repositories and bookmarks for directories in the next state.
      const nextProjectBookmarks = new Map();
      const nextProjectRepositories = new Map();
      action.payload.projectDirectories.forEach(directory => {
        const directoryPath = directory.getPath();
        const repository = state.projectRepositories.get(directoryPath);
        if (repository != null) {
          const repositoryPath = repository.getPath();
          nextProjectRepositories.set(directoryPath, repository);

          const bookmarks = state.projectBookmarks.get(repositoryPath);
          if (bookmarks != null) {
            nextProjectBookmarks.set(repositoryPath, bookmarks);
          }
        }
      });

      return {
        ...state,
        projectBookmarks: nextProjectBookmarks,
        projectDirectories: action.payload.projectDirectories,
        projectRepositories: nextProjectRepositories,
      };
    case ActionType.SET_REPOSITORY_BOOKMARKS:
      const {
        bookmarks,
        repository,
      } = action.payload;

      let nextBookmarksIsLoading;
      const bookmarksIsLoading = state.repositoryBookmarksIsLoading.get(repository);
      if (bookmarksIsLoading == null) {
        nextBookmarksIsLoading = [];
      } else {
        // Transfer only the loading state of bookmarks that are in the next list of bookmarks.
        // Other loading states should be wiped out.
        nextBookmarksIsLoading = bookmarksIsLoading.filter(loadingBookmark => {
          return bookmarks.some(bookmark => bookmarkIsEqual(bookmark, loadingBookmark));
        });
      }

      return {
        ...state,
        projectBookmarks: state.projectBookmarks.set(
          repository.getPath(),
          bookmarks,
        ),
        repositoryBookmarksIsLoading: state.repositoryBookmarksIsLoading.set(
          repository,
          nextBookmarksIsLoading,
        ),
      };
  }

  throw new Error(`Unrecognized action type: ${action.type}`);
}

export function deactivate(): void {
  disposables.dispose();
}
