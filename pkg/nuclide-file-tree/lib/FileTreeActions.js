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

import FileTreeDispatcher, {ActionTypes} from './FileTreeDispatcher';
import FileTreeHelpers from './FileTreeHelpers';
import {FileTreeStore} from './FileTreeStore';
import Immutable from 'immutable';
import {track} from '../../nuclide-analytics';
import {repositoryForPath} from '../../nuclide-vcs-base';
import {hgConstants} from '../../nuclide-hg-rpc';
import {getLogger} from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {Observable} from 'rxjs';
import {objectFromMap} from 'nuclide-commons/collection';
import {fastDebounce} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

// $FlowFixMe(>=0.53.0) Flow suppress
import type React from 'react';
import type {HgRepositoryClient} from '../../nuclide-hg-repository-client';
import type {StatusCodeNumberValue} from '../../nuclide-hg-rpc/lib/HgService';
import type {WorkingSet} from '../../nuclide-working-sets-common';
import type {WorkingSetsStore} from '../../nuclide-working-sets/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

let instance: ?FileTreeActions;

/**
 * Implements the Flux pattern for our file tree. All state for the file tree will be kept in
 * FileTreeStore and the only way to update the store is through methods on FileTreeActions. The
 * dispatcher is a mechanism through which FileTreeActions interfaces with FileTreeStore.
 */
export default class FileTreeActions {
  _dispatcher: FileTreeDispatcher;
  _store: FileTreeStore;
  _disposableForRepository: Immutable.Map<atom$Repository, IDisposable>;

  static getInstance(): FileTreeActions {
    if (!instance) {
      instance = new FileTreeActions();
    }
    return instance;
  }

  constructor() {
    this._dispatcher = FileTreeDispatcher.getInstance();
    this._store = FileTreeStore.getInstance();
    this._disposableForRepository = new Immutable.Map();
  }

  setCwd(rootKey: ?string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_CWD,
      rootKey,
    });
  }

  setRootKeys(rootKeys: Array<string>): void {
    const existingRootKeySet: Immutable.Set<string> = new Immutable.Set(
      this._store.getRootKeys(),
    );
    const addedRootKeys: Immutable.Set<string> = new Immutable.Set(
      rootKeys,
    ).subtract(existingRootKeySet);
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_ROOT_KEYS,
      rootKeys,
    });
    for (const rootKey of addedRootKeys) {
      this.expandNode(rootKey, rootKey);
    }
  }

  clearFilter(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.CLEAR_FILTER,
    });
  }

  addExtraProjectSelectionContent(content: React.Element<any>): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.ADD_EXTRA_PROJECT_SELECTION_CONTENT,
      content,
    });
  }

  removeExtraProjectSelectionContent(content: React.Element<any>): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.REMOVE_EXTRA_PROJECT_SELECTION_CONTENT,
      content,
    });
  }

  expandNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.EXPAND_NODE,
      rootKey,
      nodeKey,
    });
  }

  expandNodeDeep(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.EXPAND_NODE_DEEP,
      rootKey,
      nodeKey,
    });
  }

  deleteSelectedNodes(): void {
    this._dispatcher.dispatch({actionType: ActionTypes.DELETE_SELECTED_NODES});
  }

  // Makes sure a specific child exists for a given node. If it does not exist, temporarily
  // create it and initiate a fetch. This feature is exclusively for expanding to a node deep
  // in a tree.
  ensureChildNode(nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.ENSURE_CHILD_NODE,
      nodeKey,
    });
  }

  collapseNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.COLLAPSE_NODE,
      rootKey,
      nodeKey,
    });
  }

  collapseNodeDeep(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.COLLAPSE_NODE_DEEP,
      rootKey,
      nodeKey,
    });
  }

  setExcludeVcsIgnoredPaths(excludeVcsIgnoredPaths: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_EXCLUDE_VCS_IGNORED_PATHS,
      excludeVcsIgnoredPaths,
    });
  }

  setHideIgnoredNames(hideIgnoredNames: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_HIDE_IGNORED_NAMES,
      hideIgnoredNames,
    });
  }

  setIsCalculatingChanges(isCalculatingChanges: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_IS_CALCULATING_CHANGES,
      isCalculatingChanges,
    });
  }

  setIgnoredNames(ignoredNames: Array<string>): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_IGNORED_NAMES,
      ignoredNames,
    });
  }

  setTrackedNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_TRACKED_NODE,
      nodeKey,
      rootKey,
    });
  }

  clearTrackedNode(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.CLEAR_TRACKED_NODE,
    });
  }

  clearTrackedNodeIfNotLoading(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.CLEAR_TRACKED_NODE_IF_NOT_LOADING,
    });
  }

  startReorderDrag(draggedRootKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.START_REORDER_DRAG,
      draggedRootKey,
    });
  }

  endReorderDrag(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.END_REORDER_DRAG,
    });
  }

  reorderDragInto(dragTargetNodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.REORDER_DRAG_INTO,
      dragTargetNodeKey,
    });
  }

  reorderRoots(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.REORDER_ROOTS,
    });
  }

  moveToNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.MOVE_TO_NODE,
      nodeKey,
      rootKey,
    });
  }

  setUsePreviewTabs(usePreviewTabs: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_USE_PREVIEW_TABS,
      usePreviewTabs,
    });
  }

  setFocusEditorOnFileSelection(focusEditorOnFileSelection: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_FOCUS_EDITOR_ON_FILE_SELECTION,
      focusEditorOnFileSelection,
    });
  }

  setUsePrefixNav(usePrefixNav: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_USE_PREFIX_NAV,
      usePrefixNav,
    });
  }

  setAutoExpandSingleChild(autoExpandSingleChild: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_AUTO_EXPAND_SINGLE_CHILD,
      autoExpandSingleChild,
    });
  }

  confirmNode(
    rootKey: string,
    nodeKey: string,
    pending: boolean = false,
  ): void {
    const node = this._store.getNode(rootKey, nodeKey);
    if (node == null) {
      return;
    }
    if (node.isContainer) {
      if (node.isExpanded) {
        this._dispatcher.dispatch({
          actionType: ActionTypes.COLLAPSE_NODE,
          nodeKey,
          rootKey,
        });
      } else {
        this._dispatcher.dispatch({
          actionType: ActionTypes.EXPAND_NODE,
          nodeKey,
          rootKey,
        });
      }
    } else {
      track('file-tree-open-file', {uri: nodeKey});
      // goToLocation doesn't support pending panes
      // eslint-disable-next-line rulesdir/atom-apis
      atom.workspace.open(FileTreeHelpers.keyToPath(nodeKey), {
        activatePane:
          (pending && node.conf.focusEditorOnFileSelection) || !pending,
        searchAllPanes: true,
        pending,
      });
    }
  }

  keepPreviewTab() {
    const activePane = atom.workspace.getActivePane();
    if (activePane != null) {
      activePane.clearPendingItem();
    }
  }

  openSelectedEntrySplit(
    nodeKey: string,
    orientation: atom$PaneSplitOrientation,
    side: atom$PaneSplitSide,
  ): void {
    const pane = atom.workspace.getCenter().getActivePane();
    atom.workspace.openURIInPane(
      FileTreeHelpers.keyToPath(nodeKey),
      pane.split(orientation, side),
    );
  }

  setVcsStatuses(
    rootKey: string,
    vcsStatuses: {[path: string]: StatusCodeNumberValue},
  ): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_VCS_STATUSES,
      rootKey,
      vcsStatuses,
    });
  }

  invalidateRemovedFolder(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.INVALIDATE_REMOVED_FOLDER,
    });
  }

  /**
   * Updates the root repositories to match the provided directories.
   */
  async updateRepositories(
    rootDirectories: Array<atom$Directory>,
  ): Promise<void> {
    const rootKeys = rootDirectories.map(directory =>
      FileTreeHelpers.dirPathToKey(directory.getPath()),
    );
    const rootRepos: Array<?atom$Repository> = await Promise.all(
      // $FlowFixMe(>=0.55.0) Flow suppress
      rootDirectories.map(directory => repositoryForPath(directory.getPath())),
    );

    // t7114196: Given the current implementation of HgRepositoryClient, each root directory will
    // always correspond to a unique instance of HgRepositoryClient. Ideally, if multiple subfolders
    // of an Hg repo are used as project roots in Atom, only one HgRepositoryClient should be
    // created.

    // Group all of the root keys by their repository, excluding any that don't belong to a
    // repository.
    const rootKeysForRepository = Immutable.List(rootKeys)
      .groupBy((rootKey, index) => rootRepos[index])
      .filter((v, k) => k != null)
      .map(v => new Immutable.Set(v));

    const prevRepos = this._store.getRepositories();

    // Let the store know we have some new repos!
    const nextRepos: Immutable.Set<atom$Repository> = new Immutable.Set(
      rootKeysForRepository.keys(),
    );
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_REPOSITORIES,
      repositories: nextRepos,
    });

    const removedRepos = prevRepos.subtract(nextRepos);
    const addedRepos = nextRepos.subtract(prevRepos);

    // TODO: Rewrite `_repositoryAdded` to return the subscription instead of adding it to a map as
    //       a side effect. The map can be created here with something like
    //       `subscriptions = Immutable.Map(repos).map(this._repositoryAdded)`. Since
    //       `_repositoryAdded` will no longer be about side effects, it should then be renamed.
    //       `_repositoryRemoved` could probably be inlined here. That would leave this function as
    //       the only one doing side-effects.

    // Unsubscribe from removedRepos.
    removedRepos.forEach(repo => this._repositoryRemoved(repo));

    // Create subscriptions for addedRepos.
    addedRepos.forEach(repo =>
      this._repositoryAdded(repo, rootKeysForRepository),
    );
  }

  updateWorkingSet(workingSet: WorkingSet): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_WORKING_SET,
      workingSet,
    });
  }

  updateOpenFilesWorkingSet(openFilesWorkingSet: WorkingSet): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_OPEN_FILES_WORKING_SET,
      openFilesWorkingSet,
    });
  }

  updateWorkingSetsStore(workingSetsStore: ?WorkingSetsStore): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_WORKING_SETS_STORE,
      workingSetsStore,
    });
  }

  startEditingWorkingSet(editedWorkingSet: WorkingSet): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.START_EDITING_WORKING_SET,
      editedWorkingSet,
    });
  }

  finishEditingWorkingSet(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.FINISH_EDITING_WORKING_SET,
    });
  }

  checkNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.CHECK_NODE,
      rootKey,
      nodeKey,
    });
  }

  uncheckNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UNCHECK_NODE,
      rootKey,
      nodeKey,
    });
  }

  setDragHoveredNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_DRAG_HOVERED_NODE,
      rootKey,
      nodeKey,
    });
  }

  setSelectedNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_SELECTED_NODE,
      rootKey,
      nodeKey,
    });
  }

  setFocusedNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_FOCUSED_NODE,
      rootKey,
      nodeKey,
    });
  }

  addSelectedNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.ADD_SELECTED_NODE,
      rootKey,
      nodeKey,
    });
  }

  unselectNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UNSELECT_NODE,
      rootKey,
      nodeKey,
    });
  }

  rangeSelectToNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.RANGE_SELECT_TO_NODE,
      rootKey,
      nodeKey,
    });
  }

  rangeSelectUp(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.RANGE_SELECT_UP,
    });
  }

  rangeSelectDown(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.RANGE_SELECT_DOWN,
    });
  }

  unhoverNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UNHOVER_NODE,
      rootKey,
      nodeKey,
    });
  }

  moveSelectionUp(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.MOVE_SELECTION_UP,
    });
  }

  moveSelectionDown(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.MOVE_SELECTION_DOWN,
    });
  }

  moveSelectionToTop(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.MOVE_SELECTION_TO_TOP,
    });
  }

  moveSelectionToBottom(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.MOVE_SELECTION_TO_BOTTOM,
    });
  }

  setOpenFilesExpanded(openFilesExpanded: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_OPEN_FILES_EXPANDED,
      openFilesExpanded,
    });
  }

  setUncommittedChangesExpanded(uncommittedChangesExpanded: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_UNCOMMITTED_CHANGES_EXPANDED,
      uncommittedChangesExpanded,
    });
  }

  setFoldersExpanded(foldersExpanded: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_FOLDERS_EXPANDED,
      foldersExpanded,
    });
  }

  setTargetNode(rootKey: NuclideUri, nodeKey: NuclideUri): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_TARGET_NODE,
      rootKey,
      nodeKey,
    });
  }

  async _repositoryAdded(
    repo: atom$GitRepository | HgRepositoryClient,
    rootKeysForRepository: Immutable.Map<
      atom$Repository,
      Immutable.Set<string>,
    >,
  ): Promise<void> {
    // We support HgRepositoryClient and GitRepositoryAsync objects.

    // Observe the repository so that the VCS statuses are kept up to date.
    // This observer should fire off an initial value after we subscribe to it,
    // and subsequent values after any changes to the repository.
    let vcsChanges: Observable<{
      [filePath: NuclideUri]: StatusCodeNumberValue,
    }> = Observable.empty();
    let vcsCalculating: Observable<boolean> = Observable.of(false);

    if (repo.isDestroyed()) {
      // Don't observe anything on a destroyed repo.
    } else if (
      repo.getType() === 'git' ||
      !await FileTreeHelpers.areStackChangesEnabled()
    ) {
      // Different repo types emit different events at individual and refresh updates.
      // Hence, the need to debounce and listen to both change types.
      vcsChanges = Observable.merge(
        observableFromSubscribeFunction(repo.onDidChangeStatus.bind(repo)),
        observableFromSubscribeFunction(repo.onDidChangeStatuses.bind(repo)),
      )
        .let(fastDebounce(1000))
        .startWith(null)
        .map(_ => this._getCachedPathStatuses(repo));
    } else if (repo.getType() === 'hg') {
      // We special-case the HgRepository because it offers up the
      // required observable directly, and because it actually allows us to pick
      // between two different observables.
      const hgRepo: HgRepositoryClient = (repo: any);

      const hgChanges = FileTreeHelpers.observeUncommittedChangesKindConfigKey()
        .map(kind => {
          switch (kind) {
            case 'Uncommitted changes':
              return hgRepo.observeUncommittedStatusChanges();
            case 'Head changes':
              return hgRepo.observeHeadStatusChanges();
            case 'Stack changes':
              return hgRepo.observeStackStatusChanges();
            default:
              (kind: empty);
              const error = Observable.throw(
                new Error('Unrecognized ShowUncommittedChangesKind config'),
              );
              return {statusChanges: error, isCalculatingChanges: error};
          }
        })
        .share();

      vcsChanges = hgChanges.switchMap(c => c.statusChanges).map(objectFromMap);
      vcsCalculating = hgChanges.switchMap(c => c.isCalculatingChanges);
    }

    const subscription = vcsChanges.subscribe(statusCodeForPath => {
      for (const rootKeyForRepo of rootKeysForRepository.get(repo)) {
        this.setVcsStatuses(rootKeyForRepo, statusCodeForPath);
      }
    });

    const subscriptionCalculating = vcsCalculating.subscribe(
      isCalculatingChanges => {
        this.setIsCalculatingChanges(isCalculatingChanges);
      },
    );

    this._disposableForRepository = this._disposableForRepository.set(
      repo,
      new UniversalDisposable(subscription, subscriptionCalculating),
    );
  }

  /**
   * Fetches a consistent object map from absolute file paths to
   * their corresponding `StatusCodeNumber` for easy representation with the file tree.
   */
  _getCachedPathStatuses(
    repo: atom$GitRepository | HgRepositoryClient,
  ): {[filePath: NuclideUri]: StatusCodeNumberValue} {
    let relativeCodePaths;
    if (repo.getType() === 'hg') {
      const hgRepo: HgRepositoryClient = (repo: any);
      // `hg` already comes from `HgRepositoryClient` in `StatusCodeNumber` format.
      relativeCodePaths = hgRepo.getCachedPathStatuses();
    } else if (repo.getType() === 'git') {
      const gitRepo: atom$GitRepository = (repo: any);
      const {statuses} = gitRepo;
      const internalGitRepo = gitRepo.getRepo();
      relativeCodePaths = {};
      // Transform `git` bit numbers to `StatusCodeNumber` format.
      const {StatusCodeNumber} = hgConstants;
      for (const relativePath in statuses) {
        const gitStatusNumber = statuses[relativePath];
        let statusCode;
        if (internalGitRepo.isStatusNew(gitStatusNumber)) {
          statusCode = StatusCodeNumber.UNTRACKED;
        } else if (internalGitRepo.isStatusStaged(gitStatusNumber)) {
          statusCode = StatusCodeNumber.ADDED;
        } else if (internalGitRepo.isStatusModified(gitStatusNumber)) {
          statusCode = StatusCodeNumber.MODIFIED;
        } else if (internalGitRepo.isStatusIgnored(gitStatusNumber)) {
          statusCode = StatusCodeNumber.IGNORED;
        } else if (internalGitRepo.isStatusDeleted(gitStatusNumber)) {
          statusCode = StatusCodeNumber.REMOVED;
        } else {
          getLogger('nuclide-file-tree').warn(
            `Unrecognized git status number ${gitStatusNumber}`,
          );
          statusCode = StatusCodeNumber.MODIFIED;
        }
        relativeCodePaths[relativePath] = statusCode;
      }
    } else {
      throw new Error(`Unsupported repository type: ${repo.getType()}`);
    }
    const repoRoot = repo.getWorkingDirectory();
    const absoluteCodePaths = {};
    for (const relativePath in relativeCodePaths) {
      const absolutePath = nuclideUri.join(repoRoot, relativePath);
      absoluteCodePaths[absolutePath] = relativeCodePaths[relativePath];
    }
    return absoluteCodePaths;
  }

  _repositoryRemoved(repo: atom$Repository) {
    const disposable = this._disposableForRepository.get(repo);
    if (disposable == null) {
      // There is a small chance that the add/remove of the Repository could happen so quickly that
      // the entry for the repo in _disposableForRepository has not been set yet.
      // TODO: Report a soft error for this.
      return;
    }

    this._disposableForRepository = this._disposableForRepository.delete(repo);
    this.invalidateRemovedFolder();
    disposable.dispose();
  }
}
