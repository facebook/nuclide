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

import type {Directory} from '../FileTreeHelpers';
import type {ActionsObservable} from 'nuclide-commons/redux-observable';
// eslint-disable-next-line nuclide-internal/import-type-style
import type {Action} from '../types';
import type {RemoteFile} from '../../../nuclide-remote-connection';
import type {File} from 'atom';
import type {HgRepositoryClient} from '../../../nuclide-hg-repository-client';
import type {StatusCodeNumberValue} from '../../../nuclide-hg-rpc/lib/types';
import type {AppState, MiddlewareStore} from '../types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {GeneratedFileType} from '../../../nuclide-generated-files-rpc';

import invariant from 'assert';
import {isGkEnabled} from 'nuclide-commons/passesGK';
import * as Immutable from 'immutable';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {WORKSPACE_VIEW_URI} from '../Constants';
import * as FileTreeHgHelpers from '../FileTreeHgHelpers';
import {FileTreeNode} from '../FileTreeNode';
import * as Actions from './Actions';
import * as React from 'react';
import {getLogger} from 'log4js';
import {mapEqual, setDifference} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import nullthrows from 'nullthrows';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {fastDebounce} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';
import {repositoryForPath} from '../../../nuclide-vcs-base';
import {track} from 'nuclide-analytics';
import * as FileTreeHelpers from '../FileTreeHelpers';
import * as Selectors from '../redux/Selectors';
import {hgConstants} from '../../../nuclide-hg-rpc';
import {isRunningInWindows} from 'nuclide-commons/system-info';
import os from 'os';
import removeProjectPath from '../../../commons-atom/removeProjectPath';
import {openDialog, closeDialog} from '../../../nuclide-ui/FileActionModal';
import {getFileSystemServiceByNuclideUri} from '../../../nuclide-remote-connection';
import {awaitGeneratedFileServiceByNuclideUri} from '../../../nuclide-remote-connection';
import * as EpicHelpers from './EpicHelpers';

type CopyPath = {
  old: NuclideUri,
  new: NuclideUri,
};

const logger = getLogger('nuclide-file-tree');

export function confirmNodeEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<empty> {
  return actions
    .ofType(Actions.CONFIRM_NODE)
    .do(action => {
      invariant(action.type === Actions.CONFIRM_NODE);
      const {rootKey, nodeKey, pending} = action;

      const node = Selectors.getNode(store.getState(), rootKey, nodeKey);
      if (node == null) {
        return;
      }
      if (Selectors.getNodeIsContainer(store.getState())(node)) {
        if (node.isExpanded) {
          store.dispatch({
            type: Actions.COLLAPSE_NODE,
            nodeKey,
            rootKey,
          });
        } else {
          store.dispatch({
            type: Actions.EXPAND_NODE,
            nodeKey,
            rootKey,
          });
        }
      } else {
        track('file-tree-open-file', {uri: nodeKey});
        // goToLocation doesn't support pending panes
        // eslint-disable-next-line nuclide-internal/atom-apis
        atom.workspace.open(FileTreeHelpers.keyToPath(nodeKey), {
          activatePane:
            (pending &&
              Selectors.getFocusEditorOnFileSelection(store.getState())) ||
            !pending,
          searchAllPanes: true,
          pending,
        });
      }
    })
    .ignoreElements();
}

export function keepPreviewTabEpic(
  actions: ActionsObservable<Action>,
): Observable<empty> {
  return actions
    .ofType(Actions.KEEP_PREVIEW_TAB)
    .do(() => {
      const activePane = atom.workspace.getActivePane();
      if (activePane != null) {
        activePane.clearPendingItem();
      }
    })
    .ignoreElements();
}

export function openEntrySplitEpic(
  actions: ActionsObservable<Action>,
): Observable<empty> {
  return actions
    .ofType(Actions.OPEN_ENTRY_SPLIT)
    .do(action => {
      invariant(action.type === Actions.OPEN_ENTRY_SPLIT);
      const {nodeKey, orientation, side} = action;
      const pane = atom.workspace.getCenter().getActivePane();
      atom.workspace.openURIInPane(
        FileTreeHelpers.keyToPath(nodeKey),
        pane.split(orientation, side),
      );
    })
    .ignoreElements();
}

/**
 * Updates the root repositories to match the provided directories.
 */
export function updateRepositoriesEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<empty> {
  // TODO: This isn't really the best way to manage these. Instead we should use something like
  // `reconcileSetDiffs()`. It's only done this way because this was refactored from a giant class
  // that did this. :P
  let disposableForRepository: Immutable.Map<
    atom$Repository,
    IDisposable,
  > = new Immutable.Map();

  return actions
    .ofType(Actions.UPDATE_REPOSITORIES)
    .switchMap(async action => {
      invariant(action.type === Actions.UPDATE_REPOSITORIES);
      const {rootDirectories} = action;
      const rootKeys = rootDirectories.map(directory =>
        FileTreeHelpers.dirPathToKey(directory.getPath()),
      );
      // $FlowFixMe
      const rootRepos: Array<?atom$Repository> = await Promise.all(
        rootDirectories.map(directory =>
          repositoryForPath(directory.getPath()),
        ),
      );

      // t7114196: Given the current implementation of HgRepositoryClient, each root directory will
      // always correspond to a unique instance of HgRepositoryClient. Ideally, if multiple subfolders
      // of an Hg repo are used as project roots in Atom, only one HgRepositoryClient should be
      // created.

      // Group all of the root keys by their repository, excluding any that don't belong to a
      // repository.
      const rootKeysForRepository = Immutable.Map(
        omitNullKeys(
          Immutable.List(rootKeys).groupBy(
            (rootKey, index) => rootRepos[index],
          ),
        ).map(v => Immutable.Set(v)),
      );
      return rootKeysForRepository;
    })
    .do(rootKeysForRepository => {
      const prevRepos = Selectors.getRepositories(store.getState());

      // Let the store know we have some new repos!
      const nextRepos: Immutable.Set<atom$Repository> = Immutable.Set(
        rootKeysForRepository.keys(),
      );
      store.dispatch(Actions.setRepositories(nextRepos));

      const removedRepos = prevRepos.subtract(nextRepos);
      const addedRepos = nextRepos.subtract(prevRepos);

      // Unsubscribe from removedRepos.
      removedRepos.forEach(repo => {
        const disposable = disposableForRepository.get(repo);
        if (disposable == null) {
          // There is a small chance that the add/remove of the Repository could happen so quickly that
          // the entry for the repo in _disposableForRepository has not been set yet.
          // TODO: Report a soft error for this.
          return;
        }

        disposableForRepository = disposableForRepository.delete(repo);
        disposable.dispose();
      });

      // Create subscriptions for addedRepos.
      addedRepos.forEach(repo => {
        // We support HgRepositoryClient and GitRepositoryAsync objects.

        // Observe the repository so that the VCS statuses are kept up to date.
        // This observer should fire off an initial value after we subscribe to it,
        // and subsequent values after any changes to the repository.
        let vcsChanges: Observable<
          Map<NuclideUri, StatusCodeNumberValue>,
        > = Observable.empty();
        let vcsCalculating: Observable<boolean> = Observable.of(false);

        if (repo.isDestroyed()) {
          // Don't observe anything on a destroyed repo.
        } else if (repo.getType() === 'git') {
          // Different repo types emit different events at individual and refresh updates.
          // Hence, the need to debounce and listen to both change types.
          vcsChanges = Observable.merge(
            observableFromSubscribeFunction(repo.onDidChangeStatus.bind(repo)),
            observableFromSubscribeFunction(
              repo.onDidChangeStatuses.bind(repo),
            ),
          )
            .let(fastDebounce(1000))
            .startWith(null)
            .map(() =>
              getCachedPathStatusesForGitRepo(
                ((repo: any): atom$GitRepository),
              ),
            );
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

          vcsChanges = hgChanges
            .switchMap(c => c.statusChanges)
            .distinctUntilChanged(mapEqual);
          vcsCalculating = hgChanges.switchMap(c => c.isCalculatingChanges);
        }

        const subscription = vcsChanges.subscribe(statusCodeForPath => {
          for (const rootKeyForRepo of nullthrows(
            rootKeysForRepository.get(repo),
          )) {
            store.dispatch(
              Actions.setVcsStatuses(rootKeyForRepo, statusCodeForPath),
            );
          }
        });

        const subscriptionCalculating = vcsCalculating.subscribe(
          isCalculatingChanges => {
            store.dispatch(
              Actions.setIsCalculatingChanges(isCalculatingChanges),
            );
          },
        );

        disposableForRepository = disposableForRepository.set(
          repo,
          new UniversalDisposable(subscription, subscriptionCalculating),
        );
      });
    })
    .finally(() => {
      disposableForRepository.forEach(disposable => {
        disposable.dispose();
      });
    })
    .ignoreElements();
}

export function revealNodeKeyEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions
    .ofType(Actions.REVEAL_NODE_KEY)
    .do(action => {
      invariant(action.type === Actions.REVEAL_NODE_KEY);
      const {nodeKey} = action;
      if (nodeKey == null) {
        return;
      }
      EpicHelpers.ensureChildNode(store, nodeKey);
    })
    .ignoreElements();
}

export function revealFilePathEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions.ofType(Actions.REVEAL_FILE_PATH).switchMap(action => {
    invariant(action.type === Actions.REVEAL_FILE_PATH);
    const {filePath, showIfHidden} = action;
    const resultActions = [];

    if (showIfHidden) {
      // Ensure the file tree is visible before trying to reveal a file in it. Even if the currently
      // active pane is not an ordinary editor, we still at least want to show the tree.
      // eslint-disable-next-line nuclide-internal/atom-apis
      atom.workspace.open(WORKSPACE_VIEW_URI, {searchAllPanes: true});
      resultActions.push(Actions.setFoldersExpanded(true));
    }

    // flowlint-next-line sketchy-null-string:off
    if (filePath) {
      resultActions.push(Actions.revealNodeKey(filePath));
    }

    return Observable.from(resultActions);
  });
}

export function openAndRevealFilePathEpic(
  actions: ActionsObservable<Action>,
): Observable<Action> {
  return actions
    .map(
      action =>
        action.type === Actions.OPEN_AND_REVEAL_FILE_PATH ? action : null,
    )
    .filter(Boolean)
    .filter(action => action.filePath != null)
    .do(({filePath}) => {
      invariant(filePath != null);
      goToLocation(filePath);
    })
    .map(({filePath}) => Actions.revealNodeKey(filePath));
}

export function openAndRevealFilePathsEpic(
  actions: ActionsObservable<Action>,
): Observable<Action> {
  return actions
    .map(
      action =>
        action.type === Actions.OPEN_AND_REVEAL_FILE_PATHS ? action : null,
    )
    .filter(Boolean)
    .do(({filePaths}) => {
      filePaths.forEach(path => {
        goToLocation(path);
      });
    })
    .map(
      ({filePaths}) =>
        filePaths.length === 0
          ? null
          : Actions.revealNodeKey(filePaths[filePaths.length - 1]),
    )
    .filter(Boolean);
}

export function openAndRevealDirectoryPathEpic(
  actions: ActionsObservable<Action>,
): Observable<Action> {
  return actions
    .ofType(Actions.OPEN_AND_REVEAL_DIRECTORY_PATH)
    .map(action => {
      invariant(action.type === Actions.OPEN_AND_REVEAL_DIRECTORY_PATH);
      return action.path == null
        ? null
        : Actions.revealNodeKey(FileTreeHelpers.dirPathToKey(action.path));
    })
    .filter(Boolean);
}

export function updateRootDirectoriesEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions
    .ofType(Actions.UPDATE_ROOT_DIRECTORIES)
    .do(() => {
      // If the remote-projects package hasn't loaded yet remote directories will be instantiated as
      // local directories but with invalid paths. We need to exclude those.
      const rootDirectories = atom.project
        .getDirectories()
        .filter(directory => FileTreeHelpers.isValidDirectory(directory));
      const rootKeys = rootDirectories.map(directory =>
        FileTreeHelpers.dirPathToKey(directory.getPath()),
      );
      EpicHelpers.setRootKeys(store, rootKeys);
      store.dispatch(Actions.updateRepositories(rootDirectories));
    })
    .ignoreElements();
}

export function setCwdToSelectionEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<empty> {
  return actions
    .ofType(Actions.SET_CWD_TO_SELECTION)
    .do(() => {
      const node = Selectors.getSingleSelectedNode(store.getState());
      if (node == null) {
        return;
      }
      const path = FileTreeHelpers.keyToPath(node.uri);
      const cwdApi = Selectors.getCwdApi(store.getState());
      if (cwdApi != null) {
        cwdApi.setCwd(path);
      }
    })
    .ignoreElements();
}

export function setCwdApiEpic(
  actions: ActionsObservable<Action>,
): Observable<Action> {
  return actions
    .ofType(Actions.SET_CWD_API)
    .switchMap(action => {
      invariant(action.type === Actions.SET_CWD_API);
      const {cwdApi} = action;
      return cwdApi == null
        ? Observable.of(null)
        : observableFromSubscribeFunction(cb => cwdApi.observeCwd(cb));
    })
    .map(directory => {
      // flowlint-next-line sketchy-null-string:off
      const rootKey = directory && FileTreeHelpers.dirPathToKey(directory);
      return Actions.setCwd(rootKey);
    });
}

export function setRemoteProjectsServiceEpic(
  actions: ActionsObservable<Action>,
): Observable<Action> {
  return actions
    .ofType(Actions.SET_REMOTE_PROJECTS_SERVICE)
    .switchMap(action => {
      invariant(action.type === Actions.SET_REMOTE_PROJECTS_SERVICE);
      const {service} = action;
      // This is to workaround the initialization order problem between the
      // nuclide-remote-projects and nuclide-file-tree packages.
      // The file-tree starts up and restores its state, which can have a (remote) project root.
      // But at this point it's not a real directory. It is not present in
      // atom.project.getDirectories() and essentially it's a fake, but a useful one, as it has
      // the state (open folders, selection etc.) serialized in it. So we don't want to discard
      // it. In most cases, after a successful reconnect the real directory instance will be
      // added to the atom.project.directories and the previously fake root would become real.
      // The problem happens when the connection fails, or is canceled.
      // The fake root just stays in the file tree.
      // After remote projects have been reloaded, force a refresh to clear out the fake roots.
      return service == null
        ? Observable.empty()
        : observableFromSubscribeFunction(cb =>
            service.waitForRemoteProjectReload(cb),
          );
    })
    .map(() => Actions.updateRootDirectories());
}

/**
 * Collapses all selected directory nodes. If the selection is a single file or a single collapsed
 * directory, the selection is set to the directory's parent.
 */
export function collapseSelectionEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions.ofType(Actions.COLLAPSE_SELECTION).switchMap(action => {
    invariant(action.type === Actions.COLLAPSE_SELECTION);
    const {deep} = action;
    const selectedNodes = Selectors.getSelectedNodes(store.getState());
    const firstSelectedNode = nullthrows(selectedNodes.first());
    if (
      selectedNodes.size === 1 &&
      !firstSelectedNode.isRoot &&
      !(
        Selectors.getNodeIsContainer(store.getState())(firstSelectedNode) &&
        firstSelectedNode.isExpanded
      )
    ) {
      /*
        * Select the parent of the selection if the following criteria are met:
        *   * Only 1 node is selected
        *   * The node is not a root
        *   * The node is not an expanded directory
        */

      const parent = nullthrows(firstSelectedNode.parent);
      return Observable.of(Actions.selectAndTrackNode(parent));
    }
    const collapseActions = selectedNodes
      .map(node => {
        // Only directories can be expanded. Skip non-directory nodes.
        if (!Selectors.getNodeIsContainer(store.getState())(node)) {
          return null;
        }

        if (deep) {
          return Actions.collapseNodeDeep(node.rootUri, node.uri);
        } else {
          return Actions.collapseNode(node.rootUri, node.uri);
        }
      })
      .filter(Boolean);
    return Observable.from(collapseActions);
  });
}

export function collapseAllEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions.ofType(Actions.COLLAPSE_ALL).switchMap(() => {
    const roots = store.getState()._roots;
    return Observable.from(
      [...roots.values()].map(root =>
        Actions.collapseNodeDeep(root.uri, root.uri),
      ),
    );
  });
}

export function deleteSelectionEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<empty> {
  return actions
    .ofType(Actions.DELETE_SELECTION)
    .do(() => {
      const nodes = Selectors.getTargetNodes(store.getState());
      if (nodes.size === 0) {
        return;
      }

      const rootPaths = nodes.filter(node => node.isRoot);
      if (rootPaths.size === 0) {
        const selectedPaths = nodes.map(node => {
          const nodePath = FileTreeHelpers.keyToPath(node.uri);
          const parentOfRoot = nuclideUri.dirname(node.rootUri);

          // Fix Windows paths to avoid end of filename truncation
          return isRunningInWindows()
            ? nuclideUri.relative(parentOfRoot, nodePath).replace(/\//g, '\\')
            : nuclideUri.relative(parentOfRoot, nodePath);
        });
        const message =
          'Are you sure you want to delete the following ' +
          (nodes.size > 1 ? 'items?' : 'item?');
        atom.confirm({
          buttons: {
            Delete: () => {
              store.dispatch(Actions.deleteSelectedNodes());
            },
            Cancel: () => {},
          },
          detailedMessage: `You are deleting:${os.EOL}${selectedPaths.join(
            os.EOL,
          )}`,
          message,
        });
      } else {
        let message;
        if (rootPaths.size === 1) {
          message = `The root directory '${
            nullthrows(rootPaths.first()).name
          }' can't be removed.`;
        } else {
          const rootPathNames = rootPaths
            .map(node => `'${node.name}'`)
            .join(', ');
          message = `The root directories ${rootPathNames} can't be removed.`;
        }

        atom.confirm({
          buttons: ['OK'],
          message,
        });
      }
    })
    .ignoreElements();
}

/**
 * Expands all selected directory nodes.
 */
export function expandSelectionEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions.ofType(Actions.EXPAND_SELECTION).switchMap(action => {
    invariant(action.type === Actions.EXPAND_SELECTION);
    const {deep} = action;
    const resultActions = [Actions.clearFilter()];
    const state = store.getState();

    Selectors.getSelectedNodes(state).forEach(node => {
      // Only directories can be expanded. Skip non-directory nodes.
      if (!Selectors.getNodeIsContainer(state)(node)) {
        return;
      }

      if (deep) {
        resultActions.push(
          Actions.expandNodeDeep(node.rootUri, node.uri),
          Actions.setTrackedNode(node.rootUri, node.uri),
        );
      } else {
        if (node.isExpanded) {
          // Node is already expanded; move the selection to the first child.
          let firstChild = node.children.first();
          if (
            firstChild != null &&
            !Selectors.getNodeShouldBeShown(state)(firstChild)
          ) {
            firstChild = Selectors.findNextShownSibling(state)(firstChild);
          }

          if (firstChild != null) {
            resultActions.push(Actions.selectAndTrackNode(firstChild));
          }
        } else {
          resultActions.push(
            Actions.expandNode(node.rootUri, node.uri),
            Actions.setTrackedNode(node.rootUri, node.uri),
          );
        }
      }
    });

    return Observable.from(resultActions);
  });
}

export function openSelectedEntryEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions.ofType(Actions.OPEN_SELECTED_ENTRY).switchMap(() => {
    const resultActions = [Actions.clearFilter()];
    const singleSelectedNode = Selectors.getSingleSelectedNode(
      store.getState(),
    );
    // Only perform the default action if a single node is selected.
    if (singleSelectedNode != null) {
      resultActions.push(
        Actions.confirmNode(singleSelectedNode.rootUri, singleSelectedNode.uri),
      );
    }
    return Observable.from(resultActions);
  });
}

export function openSelectedEntrySplitEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions
    .ofType(Actions.OPEN_SELECTED_ENTRY_SPLIT)
    .map(action => {
      invariant(action.type === Actions.OPEN_SELECTED_ENTRY_SPLIT);
      const {orientation, side} = action;
      const singleSelectedNode = Selectors.getSingleTargetNode(
        store.getState(),
      );
      // Only perform the default action if a single node is selected.
      if (
        singleSelectedNode != null &&
        !Selectors.getNodeIsContainer(store.getState())(singleSelectedNode)
      ) {
        // for: is this feature used enough to justify uncollapsing?
        track('filetree-split-file', {
          orientation,
          side,
        });
        return Actions.openEntrySplit(
          singleSelectedNode.uri,
          orientation,
          side,
        );
      }
    })
    .filter(Boolean);
}

export function removeRootFolderSelection(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<empty> {
  return actions
    .ofType(Actions.REMOVE_ROOT_FOLDER_SELECTION)
    .do(() => {
      const rootNode = Selectors.getSingleSelectedNode(store.getState());
      if (rootNode != null && rootNode.isRoot) {
        logger.info('Removing project path via file tree', rootNode);
        removeProjectPath(rootNode.uri);
      }
    })
    .ignoreElements();
}

export function copyFilenamesWithDir(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<empty> {
  return actions
    .ofType(Actions.COPY_FILENAMES_WITH_DIR)
    .do(() => {
      const nodes = Selectors.getSelectedNodes(store.getState());
      const dirs = [];
      const files = [];
      for (const node of nodes) {
        const file = FileTreeHelpers.getFileByKey(node.uri);
        if (file != null) {
          files.push(file);
        }
        const dir = FileTreeHelpers.getDirectoryByKey(node.uri);
        if (dir != null) {
          dirs.push(dir);
        }
      }
      const entries = dirs.concat(files);
      if (entries.length === 0) {
        // no valid files or directories found
        return;
      }
      const dirPath = entries[0].getParent().getPath();
      if (!entries.every(e => e.getParent().getPath() === dirPath)) {
        // only copy if all selected files are in the same directory
        return;
      }

      // copy this text in case user pastes into a text area
      const copyNames = entries
        .map(e => encodeURIComponent(e.getBaseName()))
        .join();

      atom.clipboard.write(copyNames, {
        directory: FileTreeHelpers.dirPathToKey(dirPath),
        filenames: files.map(f => f.getBaseName()),
        dirnames: dirs.map(f => f.getBaseName()),
      });
    })
    .ignoreElements();
}

export function openAddFolderDialogEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<empty> {
  return actions
    .ofType(Actions.OPEN_ADD_FOLDER_DIALOG)
    .do(action => {
      invariant(action.type === Actions.OPEN_ADD_FOLDER_DIALOG);
      const {onDidConfirm} = action;
      const node = getSelectedContainerNode(store.getState());
      if (!node) {
        return;
      }
      openAddDialog(
        'folder',
        node.localPath + '/',
        async (filePath: string, options: Object) => {
          // Prevent submission of a blank field from creating a directory.
          if (filePath === '') {
            return;
          }

          // TODO: check if filePath is in rootKey and if not, find the rootKey it belongs to.
          const directory = FileTreeHelpers.getDirectoryByKey(node.uri);
          if (directory == null) {
            return;
          }

          const {path} = nuclideUri.parse(filePath);
          const basename = nuclideUri.basename(path);
          const newDirectory = directory.getSubdirectory(basename);
          let created;
          try {
            created = await newDirectory.create();
          } catch (e) {
            atom.notifications.addError(
              `Could not create directory '${basename}': ${e.toString()}`,
            );
            onDidConfirm(null);
            return;
          }
          if (!created) {
            atom.notifications.addError(`'${basename}' already exists.`);
            onDidConfirm(null);
          } else {
            onDidConfirm(newDirectory.getPath());
          }
        },
      );
    })
    .ignoreElements();
}

export function openAddFileDialogEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<empty> {
  return actions
    .ofType(Actions.OPEN_ADD_FILE_DIALOG)
    .do(action => {
      invariant(action.type === Actions.OPEN_ADD_FILE_DIALOG);
      const {onDidConfirm} = action;
      const node = getSelectedContainerNode(store.getState());
      if (!node) {
        return;
      }
      openAddFileDialogImpl(node, node.localPath, node.uri, onDidConfirm);
    })
    .ignoreElements();
}

export function openAddFileDialogRelativeEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<empty> {
  return actions
    .ofType(Actions.OPEN_ADD_FILE_DIALOG_RELATIVE)
    .do(action => {
      invariant(action.type === Actions.OPEN_ADD_FILE_DIALOG_RELATIVE);
      const {onDidConfirm} = action;
      const editor = atom.workspace.getActiveTextEditor();
      const filePath = editor != null ? editor.getPath() : null;
      // flowlint-next-line sketchy-null-string:off
      if (!filePath) {
        return;
      }

      const dirPath = FileTreeHelpers.getParentKey(filePath);
      const rootNode = Selectors.getRootForPath(store.getState(), dirPath);

      if (rootNode) {
        const localPath = nuclideUri.isRemote(dirPath)
          ? nuclideUri.parse(dirPath).path
          : dirPath;

        openAddFileDialogImpl(
          rootNode,
          FileTreeHelpers.keyToPath(localPath),
          dirPath,
          onDidConfirm,
        );
      }
    })
    .ignoreElements();
}

export function openRenameDialogEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<empty> {
  return actions
    .ofType(Actions.OPEN_RENAME_DIALOG)
    .do(() => {
      const targetNodes = Selectors.getTargetNodes(store.getState());
      if (targetNodes.size !== 1) {
        // Can only rename one entry at a time.
        return;
      }

      const node = targetNodes.first();
      invariant(node != null);
      const nodePath = node.localPath;
      openDialog({
        iconClassName: 'icon-arrow-right',
        initialValue: nodePath,
        message: Selectors.getNodeIsContainer(store.getState())(node) ? (
          <span>Enter the new path for the directory.</span>
        ) : (
          <span>Enter the new path for the file.</span>
        ),
        onConfirm: (newPath: string, options: Object) => {
          renameNode(node, nodePath, newPath).catch(error => {
            atom.notifications.addError(
              `Rename to ${newPath} failed: ${error.message}`,
            );
          });
        },
        onClose: closeDialog,
        selectBasename: true,
      });
    })
    .ignoreElements();
}

export function openDuplicateDialogEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions.ofType(Actions.OPEN_DUPLICATE_DIALOG).map(action => {
    invariant(action.type === Actions.OPEN_DUPLICATE_DIALOG);
    const {onDidConfirm} = action;
    const targetNodes = Selectors.getTargetNodes(store.getState());
    return Actions.openNextDuplicateDialog(targetNodes, onDidConfirm);
  });
}

export function openNextDuplicateDialogEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<empty> {
  return actions
    .ofType(Actions.OPEN_NEXT_DUPLICATE_DIALOG)
    .do(action => {
      invariant(action.type === Actions.OPEN_NEXT_DUPLICATE_DIALOG);
      const {nodes, onDidConfirm} = action;
      const node = nodes.first();
      invariant(node != null);
      const nodePath = nullthrows(node).localPath;
      let initialValue = nuclideUri.basename(nodePath);
      const ext = nuclideUri.extname(nodePath);
      initialValue =
        initialValue.substr(0, initialValue.length - ext.length) +
        '-copy' +
        ext;
      const hgRepository = FileTreeHgHelpers.getHgRepositoryForPath(node.uri);
      const additionalOptions = {};
      // eslint-disable-next-line eqeqeq
      if (hgRepository !== null) {
        additionalOptions.addToVCS = 'Add the new file to version control.';
      }

      const dialogProps = {
        iconClassName: 'icon-arrow-right',
        initialValue,
        message: <span>Enter the new path for the duplicate.</span>,
        onConfirm: (newBasename: string, options: {addToVCS?: boolean}) => {
          const file = FileTreeHelpers.getFileByKey(node.uri);
          if (file == null) {
            // TODO: Connection could have been lost for remote file.
            return;
          }
          duplicate(
            file,
            newBasename.trim(),
            Boolean(options.addToVCS),
            onDidConfirm,
          ).catch(error => {
            atom.notifications.addError(
              `Failed to duplicate '${file.getPath()}'`,
            );
          });
        },
        onClose: () => {
          if (nodes.rest().count() > 0) {
            store.dispatch(
              Actions.openNextDuplicateDialog(nodes.rest(), onDidConfirm),
            );
          } else {
            closeDialog();
          }
        },
        selectBasename: true,
        additionalOptions,
      };
      openDialog(dialogProps);
    })
    .ignoreElements();
}

export function openPasteDialogEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<empty> {
  return actions
    .ofType(Actions.OPEN_PASTE_DIALOG)
    .do(() => {
      const node = Selectors.getSingleSelectedNode(store.getState());
      if (node == null) {
        // don't paste if unselected
        return;
      }

      let newPath = FileTreeHelpers.getDirectoryByKey(node.uri);
      if (newPath == null) {
        // maybe it's a file?
        const file = FileTreeHelpers.getFileByKey(node.uri);
        if (file == null) {
          // nope! do nothing if we can't find an entry
          return;
        }
        newPath = file.getParent();
      }

      const additionalOptions = {};
      // eslint-disable-next-line eqeqeq
      if (FileTreeHgHelpers.getHgRepositoryForPath(node.uri) !== null) {
        additionalOptions.addToVCS = 'Add the new file(s) to version control.';
      }
      openDialog({
        iconClassName: 'icon-arrow-right',
        ...getPasteDialogProps(newPath),
        onConfirm: (pasteDirPath: string, options: {addToVCS?: boolean}) => {
          paste(pasteDirPath.trim(), Boolean(options.addToVCS)).catch(error => {
            atom.notifications.addError(
              `Failed to paste into '${pasteDirPath}': ${error}`,
            );
          });
        },
        onClose: closeDialog,
        additionalOptions,
      });
    })
    .ignoreElements();
}

export function updateWorkingSetEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<empty> {
  return actions
    .ofType(Actions.WORKING_SET_CHANGE_REQUESTED)
    .do(action => {
      invariant(action.type === Actions.WORKING_SET_CHANGE_REQUESTED);
      const {workingSet} = action;

      // TODO (T30814717): Make this the default behavior after some research.
      if (isGkEnabled('nuclide_projects') === true) {
        const prevWorkingSet = Selectors.getWorkingSet(store.getState());
        const prevUris = new Set(prevWorkingSet.getUris());
        const nextUris = new Set(workingSet.getUris());
        const addedUris = setDifference(nextUris, prevUris);
        // Reveal all of the added paths. This is a little gross. The WorkingSetStore API will return
        // absolute paths (`/a/b/c`) for remote directories instead of `nuclide://` URIs. In other
        // words, we don't have enough information to know what paths to reveal. So we'll just try to
        // reveal the path in every root.
        addedUris.forEach(uri => {
          Selectors.getRootKeys(store.getState()).forEach(rootUri => {
            const filePath = nuclideUri.resolve(rootUri, uri);
            const nodeKey = FileTreeHelpers.dirPathToKey(filePath);
            store.dispatch(Actions.revealFilePath(nodeKey, false));
            if (nextUris.size === 1) {
              // There's only a single URI in the working set, expand it.
              store.dispatch(Actions.expandNode(rootUri, nodeKey));
            }
          });
        });
      }

      store.dispatch(Actions.setWorkingSet(workingSet));
    })
    .ignoreElements();
}

export function deleteSelectedNodesEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions
    .ofType(Actions.DELETE_SELECTED_NODES)
    .mergeMap(async action => {
      invariant(action.type === Actions.DELETE_SELECTED_NODES);
      const selectedNodes = Selectors.getSelectedNodes(store.getState());
      try {
        await FileTreeHgHelpers.deleteNodes(selectedNodes.toArray());
        return Actions.clearSelectionRange();
      } catch (e) {
        atom.notifications.addError('Failed to delete entries: ' + e.message);
      }
      return null;
    })
    .filter(Boolean);
}

export function moveToNodeEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions.ofType(Actions.MOVE_TO_NODE).mergeMap(action => {
    invariant(action.type === Actions.MOVE_TO_NODE);
    const {rootKey, nodeKey} = action;
    const targetNode = Selectors.getNode(store.getState(), rootKey, nodeKey);
    if (
      targetNode == null ||
      !Selectors.getNodeIsContainer(store.getState())(targetNode)
    ) {
      return Observable.empty();
    }
    const selectedNodes = Selectors.getSelectedNodes(store.getState());

    // This is async but we don't care.
    FileTreeHgHelpers.moveNodes(selectedNodes.toArray(), targetNode.uri);
    return Observable.of(Actions.clearDragHover(), Actions.clearSelection());
  });
}

export function movePathToNodeEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions.ofType(Actions.MOVE_PATH_TO_NODE).mergeMap(action => {
    invariant(action.type === Actions.MOVE_PATH_TO_NODE);
    const {uri, destination} = action;
    track('file-tree-move-dropped-external-file:started', {
      source: uri,
      destination: destination.uri,
    });
    if (!Selectors.getNodeIsContainer(store.getState())(destination)) {
      track('file-tree-move-dropped-external-file:failed', {
        reason: 'Destination is not a container',
      });
      return Observable.empty();
    }
    if (!FileTreeHgHelpers.isValidRename(uri, destination.uri)) {
      const detail = `Unable to move \`${uri}\` to \`${destination.uri}\`.`;
      track('file-tree-move-dropped-external-file:failed', {
        reason: detail,
      });
      atom.notifications.addError('File move failed', {detail});
      return Observable.empty();
    }

    const newPath = nuclideUri.join(destination.uri, nuclideUri.basename(uri));
    FileTreeHgHelpers.movePaths([uri], destination.uri).then(() => {
      // Note: While the move is "complete" FileTreeHgHelpers will silently skip
      // files that it does not think it can move, and will noop if another move
      // is already in progress.
      track('file-tree-move-dropped-external-file:completed', {
        source: uri,
        destination: destination.uri,
      });
      EpicHelpers.ensureChildNode(store, newPath);
    });
    return Observable.of(Actions.clearDragHover(), Actions.clearSelection());
  });
}

export function expandNodeEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions
    .ofType(Actions.EXPAND_NODE)
    .do(action => {
      invariant(action.type === Actions.EXPAND_NODE);
      const {rootKey, nodeKey} = action;
      EpicHelpers.expandNode(store, rootKey, nodeKey);
    })
    .ignoreElements();
}

export function expandNodeDeepEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions
    .ofType(Actions.EXPAND_NODE_DEEP)
    .do(action => {
      invariant(action.type === Actions.EXPAND_NODE_DEEP);
      const {rootKey, nodeKey} = action;
      EpicHelpers.expandNodeDeep(store, rootKey, nodeKey);
    })
    .ignoreElements();
}

export function reorderRootsEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions
    .ofType(Actions.REORDER_ROOTS)
    .do(action => {
      invariant(action.type === Actions.REORDER_ROOTS);
      const rootKeys = Selectors.getRootKeys(store.getState());
      const rps = this._reorderPreviewStatus;
      if (rps == null) {
        return;
      }
      const sourceIdx = rps.sourceIdx;
      const targetIdx = rps.targetIdx;
      if (targetIdx == null || sourceIdx === targetIdx) {
        return;
      }

      rootKeys.splice(sourceIdx, 1);
      rootKeys.splice(targetIdx, 0, rps.source);
      EpicHelpers.setRootKeys(store, rootKeys);
    })
    .ignoreElements();
}

// FIXME: Most of this is just synchronous stuff that should be moved into the initial store state.
// The only sticking point is the async call to `fetchChildKeys`, but that can probably be done in
// a second pass after loading?
export function loadDataEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions
    .ofType(Actions.LOAD_DATA)
    .map(action => {
      invariant(action.type === Actions.LOAD_DATA);
      const {data} = action;

      // Ensure we are not trying to load data from an earlier version of this package.
      if (data.version !== Selectors.getVersion(store.getState())) {
        return null;
      }

      const buildRootNode = (rootUri: string) => {
        EpicHelpers.fetchChildKeys(store, rootUri);

        return new FileTreeNode({
          uri: rootUri,
          rootUri,
          isExpanded: true,
          isLoading: true,
          children: Immutable.OrderedMap(),
          isCwd: false,
          connectionTitle: FileTreeHelpers.getDisplayTitle(rootUri) || '',
        });
      };

      const normalizedAtomPaths = atom.project
        .getPaths()
        .map(nuclideUri.ensureTrailingSeparator);
      const normalizedDataPaths = data.rootKeys
        .map(nuclideUri.ensureTrailingSeparator)
        .filter(
          rootUri =>
            nuclideUri.isRemote(rootUri) ||
            normalizedAtomPaths.indexOf(rootUri) >= 0,
        );
      const pathsMissingInData = normalizedAtomPaths.filter(
        rootUri => normalizedDataPaths.indexOf(rootUri) === -1,
      );
      const combinedPaths = normalizedDataPaths.concat(pathsMissingInData);

      const roots = Immutable.OrderedMap(
        combinedPaths.map(rootUri => [rootUri, buildRootNode(rootUri)]),
      );

      return Actions.setInitialData({
        roots,
        openFilesExpanded: data.openFilesExpanded,
        uncommittedChangesExpanded: data.uncommittedChangesExpanded,
        foldersExpanded: data.foldersExpanded,
      });
    })
    .filter(Boolean);
}

export function updateGeneratedStatusEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return Observable.merge(
    actions.ofType(Actions.SET_OPEN_FILES_WORKING_SET).map(action => {
      invariant(action.type === Actions.SET_OPEN_FILES_WORKING_SET);
      return action.openFilesWorkingSet.getAbsoluteUris();
    }),
    actions.ofType(Actions.SET_VCS_STATUSES).map(action => {
      invariant(action.type === Actions.SET_VCS_STATUSES);
      return [...action.vcsStatuses.keys()];
    }),
  ).mergeMap(async filesToCheck => {
    const generatedPromises: Map<
      NuclideUri,
      Promise<[NuclideUri, GeneratedFileType]>,
    > = new Map();
    for (const file of filesToCheck) {
      if (!generatedPromises.has(file)) {
        const promise = awaitGeneratedFileServiceByNuclideUri(file)
          .then(gfs => gfs.getGeneratedFileType(file))
          .then(type => [file, type]);
        generatedPromises.set(file, promise);
      }
    }
    const generatedFileTypes = await Promise.all(
      Array.from(generatedPromises.values()),
    );
    return Actions.updateGeneratedStatuses(new Map(generatedFileTypes));
  });
}

export function uploadDroppedFilesEpic(
  actions: ActionsObservable<Action>,
  store: MiddlewareStore,
): Observable<Action> {
  return actions.ofType(Actions.UPLOAD_DROPPED_FILES).mergeMap(action => {
    invariant(action.type === 'UPLOAD_DROPPED_FILES');
    const {destination} = action;
    const {remoteTransferService} = store.getState();
    if (
      remoteTransferService == null ||
      !Selectors.getNodeIsContainer(store.getState())(destination)
    ) {
      return Observable.empty();
    }
    // > Electron has added a path attribute to the File interface which exposes
    // > the file's real path on filesystem.
    // -- https://electronjs.org/docs/api/file-object
    // $FlowFixMe
    const files = Array.from(action.files).map(file => file.path);
    track('file-tree-upload-dropped-files', {count: files.length});

    return Observable.concat(
      Observable.of(Actions.clearDragHover(), Actions.clearSelection()),
      Observable.fromPromise(
        remoteTransferService.uploadFiles(files, destination.uri),
      ).mapTo(Actions.expandNode(destination.rootUri, destination.uri)),
    );
  });
}

//
// Helper functions
//

/**
 * A flow-friendly way of filtering out null keys.
 */
function omitNullKeys<T, U>(
  map: Immutable.KeyedSeq<?T, U>,
): Immutable.KeyedCollection<T, U> {
  return (map.filter((v, k) => k != null): any);
}

/**
 * Fetches a consistent object map from absolute file paths to
 * their corresponding `StatusCodeNumber` for easy representation with the file tree.
 */
function getCachedPathStatusesForGitRepo(
  repo: atom$GitRepository,
): Map<NuclideUri, StatusCodeNumberValue> {
  const gitRepo: atom$GitRepository = (repo: any);
  const {statuses} = gitRepo;
  const internalGitRepo = gitRepo.getRepo();
  const codePathStatuses = new Map();
  const repoRoot = repo.getWorkingDirectory();
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
    codePathStatuses.set(nuclideUri.join(repoRoot, relativePath), statusCode);
  }

  return codePathStatuses;
}

function getSelectedContainerNode(state: AppState): ?FileTreeNode {
  /*
   * TODO: Choosing the last selected key is inexact when there is more than 1 root. The Set of
   * selected keys should be maintained as a flat list across all roots to maintain insertion
   * order.
   */
  const node = Selectors.getSelectedNodes(state).first();
  if (node) {
    return Selectors.getNodeIsContainer(state)(node) ? node : node.parent;
  }

  return null;
}

function openAddDialog(
  entryType: string,
  path: string,
  onConfirm: (filePath: string, options: Object) => mixed,
  additionalOptions?: Object = {},
) {
  openDialog({
    iconClassName: 'icon-file-add',
    message: (
      <span>
        Enter the path for the new {entryType} in the root:<br />
        {path}
      </span>
    ),
    onConfirm,
    onClose: closeDialog,
    additionalOptions,
  });
}

function openAddFileDialogImpl(
  rootNode: FileTreeNode,
  localPath: NuclideUri,
  filePath: NuclideUri,
  onDidConfirm: (filePath: ?string) => mixed,
): void {
  const hgRepository = FileTreeHgHelpers.getHgRepositoryForPath(rootNode.uri);
  const additionalOptions = {};
  if (hgRepository != null) {
    additionalOptions.addToVCS = 'Add the new file to version control.';
  }
  openAddDialog(
    'file',
    nuclideUri.ensureTrailingSeparator(localPath),
    async (pathToCreate: string, options: {addToVCS?: boolean}) => {
      // Prevent submission of a blank field from creating a file.
      if (pathToCreate === '') {
        return;
      }

      // TODO: check if pathToCreate is in rootKey and if not, find the rootKey it belongs to.
      const directory = FileTreeHelpers.getDirectoryByKey(filePath);
      if (directory == null) {
        return;
      }

      const newFile = directory.getFile(pathToCreate);
      let created;
      try {
        created = await newFile.create();
      } catch (e) {
        atom.notifications.addError(
          `Could not create file '${newFile.getPath()}': ${e.toString()}`,
        );
        onDidConfirm(null);
        return;
      }
      if (!created) {
        atom.notifications.addError(`'${pathToCreate}' already exists.`);
        onDidConfirm(null);
        return;
      }

      const newFilePath = newFile.getPath();
      // Open a new text editor while VCS actions complete in the background.
      onDidConfirm(newFilePath);
      if (hgRepository != null && options.addToVCS === true) {
        try {
          await hgRepository.addAll([newFilePath]);
        } catch (e) {
          atom.notifications.addError(
            `Failed to add '${newFilePath}' to version control. Error: ${e.toString()}`,
          );
        }
      }
    },
    additionalOptions,
  );
}

async function renameNode(
  node: FileTreeNode,
  nodePath: string,
  destPath: string,
): Promise<void> {
  /*
   * Use `resolve` to strip trailing slashes because renaming a file to a name with a
   * trailing slash is an error.
   */
  let newPath = nuclideUri.resolve(destPath.trim());

  // Create a remote nuclide uri when the node being moved is remote.
  if (nuclideUri.isRemote(node.uri)) {
    newPath = nuclideUri.createRemoteUri(
      nuclideUri.getHostname(node.uri),
      newPath,
    );
  }

  await FileTreeHgHelpers.renameNode(node, newPath);
}

async function duplicate(
  file: File | RemoteFile,
  newBasename: string,
  addToVCS: boolean,
  onDidConfirm: (filePaths: Array<string>) => mixed,
): Promise<void> {
  const directory = file.getParent();
  const newFile = directory.getFile(newBasename);
  return copy(
    [{old: file.getPath(), new: newFile.getPath()}],
    addToVCS,
    onDidConfirm,
  );
}

async function copy(
  copyPaths: Array<CopyPath>,
  addToVCS: boolean,
  onDidConfirm: (filePaths: Array<string>) => mixed,
): Promise<void> {
  const copiedPaths = await Promise.all(
    copyPaths
      .filter(
        ({old: oldPath, new: newPath}) =>
          nuclideUri.getHostnameOpt(oldPath) ===
          nuclideUri.getHostnameOpt(newPath),
      )
      .map(async ({old: oldPath, new: newPath}) => {
        const service = getFileSystemServiceByNuclideUri(newPath);
        const isFile = (await service.stat(oldPath)).isFile();
        const exists = isFile
          ? !(await service.copy(oldPath, newPath))
          : !(await service.copyDir(oldPath, newPath));
        if (exists) {
          atom.notifications.addError(`'${newPath}' already exists.`);
          return [];
        } else {
          return [newPath];
        }
      }),
  );

  const successfulPaths = [].concat(...copiedPaths);
  onDidConfirm(successfulPaths);

  if (successfulPaths.length !== 0) {
    const hgRepository = FileTreeHgHelpers.getHgRepositoryForPath(
      successfulPaths[0],
    );
    if (hgRepository != null && addToVCS) {
      try {
        // We are not recording the copy in mercurial on purpose, because most of the time
        // it's either templates or files that have greatly changed since duplicating.
        await hgRepository.addAll(successfulPaths);
      } catch (e) {
        const message =
          'Paths were duplicated, but there was an error adding them to ' +
          'version control.  Error: ' +
          e.toString();
        atom.notifications.addError(message);
        return;
      }
    }
  }
}
async function paste(
  newPath: string,
  addToVCS: boolean,
  onDidConfirm: (filePath: Array<string>) => mixed = () => {},
): Promise<void> {
  const copyPaths = [];
  const cb = atom.clipboard.readWithMetadata();
  const oldDir = getDirectoryFromMetadata(cb.metadata);
  if (oldDir == null) {
    // bad source
    return;
  }

  const filenames = cb.text.split(',');
  const newFile = FileTreeHelpers.getFileByKey(newPath);
  const newDir = FileTreeHelpers.getDirectoryByKey(newPath);

  if (newFile == null && newDir == null) {
    // newPath doesn't resolve to a file or path
    atom.notifications.addError('Invalid target');
    return;
  } else if (filenames.length === 1) {
    const origFilePath = oldDir.getFile(cb.text).getPath();
    if (newFile != null) {
      // single file on clibboard; Path resolves to a file.
      // => copy old file into new file
      const destFilePath = newFile.getPath();
      copyPaths.push({old: origFilePath, new: destFilePath});
    } else if (newDir != null) {
      // single file on clibboard; Path resolves to a folder.
      // => copy old file into new newDir folder
      const destFilePath = newDir.getFile(cb.text).getPath();
      copyPaths.push({old: origFilePath, new: destFilePath});
    }
  } else {
    // multiple files in cb
    if (newDir == null) {
      atom.notifications.addError('Cannot rename when pasting multiple files');
      return;
    }

    filenames.forEach(encodedFilename => {
      const filename = decodeURIComponent(encodedFilename);
      const origFilePath = oldDir.getFile(filename).getPath();
      const destFilePath = newDir.getFile(filename).getPath();
      copyPaths.push({old: origFilePath, new: destFilePath});
    });
  }

  await copy(copyPaths, addToVCS, onDidConfirm);
}

function getDirectoryFromMetadata(cbMeta: ?mixed): ?Directory {
  if (
    cbMeta == null ||
    typeof cbMeta !== 'object' ||
    cbMeta.directory == null ||
    typeof cbMeta.directory !== 'string'
  ) {
    return null;
  }
  return FileTreeHelpers.getDirectoryByKey(cbMeta.directory);
}

// provide appropriate UI feedback depending on whether user
// has single or multiple files in the clipboard
function getPasteDialogProps(
  path: Directory,
): {initialValue: string, message: React.Element<string>} {
  const cb = atom.clipboard.readWithMetadata();
  const filenames = cb.text.split(',');
  if (filenames.length === 1) {
    return {
      initialValue: path.getFile(cb.text).getPath(),
      message: <span>Paste file from clipboard into</span>,
    };
  } else {
    return {
      initialValue: FileTreeHelpers.dirPathToKey(path.getPath()),
      message: (
        <span>Paste files from clipboard into the following folder</span>
      ),
    };
  }
}
