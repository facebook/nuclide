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

import type {CwdApi} from '../../nuclide-current-working-directory/lib/CwdApi';
import type {RemoteProjectsService} from '../../nuclide-remote-projects';
import type {ExportStoreData} from './FileTreeStore';
// $FlowFixMe(>=0.53.0) Flow suppress
import type React from 'react';

import {COMMANDS_SELECTOR} from './FileTreeConstants';
import FileSystemActions from './FileSystemActions';
import FileTreeActions from './FileTreeActions';
import FileTreeContextMenu from './FileTreeContextMenu';
import FileTreeHelpers from './FileTreeHelpers';
import {FileTreeStore} from './FileTreeStore';
import * as Immutable from 'immutable';
import {track} from '../../nuclide-analytics';
import nullthrows from 'nullthrows';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import getElementFilePath from '../../commons-atom/getElementFilePath';
import removeProjectPath from '../../commons-atom/removeProjectPath';
import {isRunningInWindows} from '../../commons-node/system-info';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {WORKSPACE_VIEW_URI} from './Constants';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-file-tree');

import os from 'os';
import {shell} from 'electron';

import invariant from 'assert';

import type {WorkingSet} from '../../nuclide-working-sets-common';
import type {WorkingSetsStore} from '../../nuclide-working-sets/lib/types';
import type {FileTreeNode} from './FileTreeNode';

const VALID_FILTER_CHARS =
  '!#./0123456789-:;?@ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  '_abcdefghijklmnopqrstuvwxyz~';

class ProjectSelectionManager {
  _actions: FileTreeActions;
  _store: FileTreeStore;

  constructor() {
    this._actions = FileTreeActions.getInstance();
    this._store = FileTreeStore.getInstance();
  }

  addExtraContent(content: React.Element<any>): IDisposable {
    this._actions.addExtraProjectSelectionContent(content);
    return new UniversalDisposable(() =>
      this._actions.removeExtraProjectSelectionContent(content),
    );
  }

  getExtraContent(): Immutable.List<React.Element<any>> {
    return this._store.getExtraProjectSelectionContent();
  }
}

export type FileTreeProjectSelectionManager = ProjectSelectionManager;

export default class FileTreeController {
  _actions: FileTreeActions;
  _contextMenu: FileTreeContextMenu;
  _projectSelectionManager: ProjectSelectionManager;
  _cwdApi: ?CwdApi;
  _remoteProjectsService: ?RemoteProjectsService;
  _cwdApiSubscription: ?IDisposable;
  _repositories: Immutable.Set<atom$Repository>;
  _store: FileTreeStore;
  _disposables: UniversalDisposable;
  _disposableForRepository: Immutable.Map<atom$Repository, IDisposable>;

  constructor(state: ?ExportStoreData) {
    this._actions = FileTreeActions.getInstance();
    this._store = FileTreeStore.getInstance();
    this._projectSelectionManager = new ProjectSelectionManager();
    this._repositories = Immutable.Set();
    this._disposableForRepository = Immutable.Map();
    this._disposables = new UniversalDisposable(() => {
      if (this._cwdApiSubscription != null) {
        this._cwdApiSubscription.dispose();
      }
    });
    // Initial root directories
    this._updateRootDirectories();
    // Subsequent root directories updated on change
    this._disposables.add(
      atom.project.onDidChangePaths(() => this._updateRootDirectories()),
      atom.commands.add('atom-workspace', {
        'nuclide-file-tree:reveal-active-file': this._revealFile.bind(this),
        'nuclide-file-tree:recursive-collapse-all': this._collapseAll.bind(
          this,
        ),
        'nuclide-file-tree:add-file-relative': () => {
          FileSystemActions.openAddFileDialogRelative(
            this._openAndRevealFilePath.bind(this),
          );
        },
      }),
    );
    const letterKeyBindings = {
      'nuclide-file-tree:remove-letter': this._handleRemoveLetterKeypress.bind(
        this,
      ),
      'nuclide-file-tree:clear-filter': this._handleClearFilter.bind(this),
    };
    for (
      let i = 0, c = VALID_FILTER_CHARS.charCodeAt(0);
      i < VALID_FILTER_CHARS.length;
      i++, c = VALID_FILTER_CHARS.charCodeAt(i)
    ) {
      const char = String.fromCharCode(c);
      letterKeyBindings[
        `nuclide-file-tree:go-to-letter-${char}`
      ] = this._handlePrefixKeypress.bind(this, char);
    }
    this._disposables.add(
      atom.commands.add(COMMANDS_SELECTOR, {
        'core:move-down': this._moveDown.bind(this),
        'core:move-up': this._moveUp.bind(this),
        'core:move-to-top': this._moveToTop.bind(this),
        'core:move-to-bottom': this._moveToBottom.bind(this),
        'core:select-up': this._rangeSelectUp.bind(this),
        'core:select-down': this._rangeSelectDown.bind(this),
        'nuclide-file-tree:add-file': () => {
          FileSystemActions.openAddFileDialog(
            this._openAndRevealFilePath.bind(this),
          );
        },
        'nuclide-file-tree:add-folder': () => {
          FileSystemActions.openAddFolderDialog(
            this._openAndRevealDirectoryPath.bind(this),
          );
        },
        'nuclide-file-tree:collapse-directory': this._collapseSelection.bind(
          this,
          /* deep */ false,
        ),
        'nuclide-file-tree:recursive-collapse-directory': this._collapseSelection.bind(
          this,
          true,
        ),
        'nuclide-file-tree:expand-directory': this._expandSelection.bind(
          this,
          /* deep */ false,
        ),
        'nuclide-file-tree:recursive-expand-directory': this._expandSelection.bind(
          this,
          true,
        ),
        'nuclide-file-tree:open-selected-entry': this._openSelectedEntry.bind(
          this,
        ),
        'nuclide-file-tree:open-selected-entry-up': this._openSelectedEntrySplitUp.bind(
          this,
        ),
        'nuclide-file-tree:open-selected-entry-down': this._openSelectedEntrySplitDown.bind(
          this,
        ),
        'nuclide-file-tree:open-selected-entry-left': this._openSelectedEntrySplitLeft.bind(
          this,
        ),
        'nuclide-file-tree:open-selected-entry-right': this._openSelectedEntrySplitRight.bind(
          this,
        ),
        'nuclide-file-tree:remove': this._deleteSelection.bind(this),
        'core:delete': this._deleteSelection.bind(this),
        'nuclide-file-tree:remove-project-folder-selection': this._removeRootFolderSelection.bind(
          this,
        ),
        'nuclide-file-tree:rename-selection': () =>
          FileSystemActions.openRenameDialog(),
        'nuclide-file-tree:duplicate-selection': () => {
          FileSystemActions.openDuplicateDialog(
            this._openAndRevealFilePaths.bind(this),
          );
        },
        'nuclide-file-tree:copy-selection': this._copyFilenamesWithDir.bind(
          this,
        ),
        'nuclide-file-tree:paste-selection': () =>
          FileSystemActions.openPasteDialog(),
        'nuclide-file-tree:search-in-directory': this._searchInDirectory.bind(
          this,
        ),
        'nuclide-file-tree:set-current-working-root': this._setCwdToSelection.bind(
          this,
        ),
        ...letterKeyBindings,
      }),
      atom.commands.add('atom-workspace', {
        // eslint-disable-next-line rulesdir/atom-apis
        'file:copy-full-path': this._copyFullPath.bind(this),
        // eslint-disable-next-line rulesdir/atom-apis
        'file:show-in-file-manager': this._showInFileManager.bind(this),
      }),
    );
    if (state != null) {
      this._store.loadData(state);
    }
    this._contextMenu = new FileTreeContextMenu();
  }

  _moveUp(): void {
    this._actions.moveSelectionUp();
  }

  _moveDown(): void {
    this._actions.moveSelectionDown();
  }

  _moveToTop(): void {
    this._actions.moveSelectionToTop();
  }

  _moveToBottom(): void {
    this._actions.moveSelectionToBottom();
  }

  _rangeSelectUp(): void {
    this._actions.rangeSelectUp();
  }

  _rangeSelectDown(): void {
    this._actions.rangeSelectDown();
  }

  getContextMenu(): FileTreeContextMenu {
    return this._contextMenu;
  }

  getProjectSelectionManager(): ProjectSelectionManager {
    return this._projectSelectionManager;
  }

  _handleClearFilter(): void {
    this._store.clearFilter();
  }

  _handlePrefixKeypress(letter: string): void {
    if (!this._store.usePrefixNav()) {
      return;
    }

    this._store.addFilterLetter(letter);
  }

  _handleRemoveLetterKeypress(): void {
    if (!this._store.usePrefixNav()) {
      return;
    }
    this._store.removeFilterLetter();
  }

  _openAndRevealFilePath(filePath: ?string): void {
    if (filePath != null) {
      goToLocation(filePath);
      this.revealNodeKey(filePath);
    }
  }

  _openAndRevealFilePaths(filePaths: Array<string>): void {
    for (let i = 0; i < filePaths.length; i++) {
      goToLocation(filePaths[i]);
    }
    if (filePaths.length !== 0) {
      this.revealNodeKey(filePaths[filePaths.length - 1]);
    }
  }

  _openAndRevealDirectoryPath(path: ?string): void {
    if (path != null) {
      this.revealNodeKey(FileTreeHelpers.dirPathToKey(path));
    }
  }

  _updateRootDirectories(): void {
    // If the remote-projects package hasn't loaded yet remote directories will be instantiated as
    // local directories but with invalid paths. We need to exclude those.
    const rootDirectories = atom.project
      .getDirectories()
      .filter(directory => FileTreeHelpers.isValidDirectory(directory));
    const rootKeys = rootDirectories.map(directory =>
      FileTreeHelpers.dirPathToKey(directory.getPath()),
    );
    this._actions.setRootKeys(rootKeys);
    this._actions.updateRepositories(rootDirectories);
  }

  _revealFile(event: Event): void {
    let path = getElementFilePath(((event.target: any): HTMLElement));

    if (path == null) {
      const editor = atom.workspace.getActiveTextEditor();
      path = editor != null ? editor.getPath() : null;
      if (path == null) {
        return;
      }
    }

    this.revealFilePath(path);
  }

  revealFilePath(filePath: ?string, showIfHidden?: boolean = true): void {
    if (showIfHidden) {
      // Ensure the file tree is visible before trying to reveal a file in it. Even if the currently
      // active pane is not an ordinary editor, we still at least want to show the tree.
      // eslint-disable-next-line rulesdir/atom-apis
      atom.workspace.open(WORKSPACE_VIEW_URI, {searchAllPanes: true});
      this._actions.setFoldersExpanded(true);
    }

    // flowlint-next-line sketchy-null-string:off
    if (!filePath) {
      return;
    }

    this.revealNodeKey(filePath);
  }

  revealNodeKey(nodeKey: ?string): void {
    if (nodeKey == null) {
      return;
    }

    this._actions.ensureChildNode(nodeKey);
  }

  _setCwdToSelection(): void {
    const node = this._store.getSingleSelectedNode();
    if (node == null) {
      return;
    }
    const path = FileTreeHelpers.keyToPath(node.uri);
    if (this._cwdApi != null) {
      this._cwdApi.setCwd(path);
    }
  }

  setCwdApi(cwdApi: ?CwdApi): void {
    if (cwdApi == null) {
      this._actions.setCwd(null);
      this._cwdApiSubscription = null;
    } else {
      invariant(this._cwdApiSubscription == null);
      this._cwdApiSubscription = cwdApi.observeCwd(directory => {
        const path = directory == null ? null : directory.getPath();
        // flowlint-next-line sketchy-null-string:off
        const rootKey = path && FileTreeHelpers.dirPathToKey(path);
        this._actions.setCwd(rootKey);
      });
    }

    this._cwdApi = cwdApi;
  }

  setRemoteProjectsService(service: ?RemoteProjectsService): void {
    if (service != null) {
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
      this._disposables.add(
        service.waitForRemoteProjectReload(
          this._updateRootDirectories.bind(this),
        ),
      );
    }
    this._remoteProjectsService = service;
  }

  setExcludeVcsIgnoredPaths(excludeVcsIgnoredPaths: boolean): void {
    this._actions.setExcludeVcsIgnoredPaths(excludeVcsIgnoredPaths);
  }

  setHideVcsIgnoredPaths(hideVcsIgnoredPaths: boolean): void {
    this._actions.setHideVcsIgnoredPaths(hideVcsIgnoredPaths);
  }

  setHideIgnoredNames(hideIgnoredNames: boolean): void {
    this._actions.setHideIgnoredNames(hideIgnoredNames);
  }

  setIgnoredNames(ignoredNames: Array<string>): void {
    this._actions.setIgnoredNames(ignoredNames);
  }

  setUsePreviewTabs(usePreviewTabs: boolean): void {
    this._actions.setUsePreviewTabs(usePreviewTabs);
  }

  setUsePrefixNav(usePrefixNav: boolean): void {
    this._actions.setUsePrefixNav(usePrefixNav);
  }

  setAutoExpandSingleChild(autoExpandSingleChild: boolean): void {
    this._store._setAutoExpandSingleChild(autoExpandSingleChild);
  }

  setFocusEditorOnFileSelection(focusEditorOnFileSelection: boolean): void {
    this._actions.setFocusEditorOnFileSelection(focusEditorOnFileSelection);
  }

  updateWorkingSet(workingSet: WorkingSet): void {
    this._actions.updateWorkingSet(workingSet);
  }

  updateWorkingSetsStore(workingSetsStore: ?WorkingSetsStore): void {
    this._actions.updateWorkingSetsStore(workingSetsStore);
  }

  updateOpenFilesWorkingSet(openFilesWorkingSet: WorkingSet): void {
    this._actions.updateOpenFilesWorkingSet(openFilesWorkingSet);
  }

  collectDebugState(): Object {
    return this._store.collectDebugState();
  }

  /**
   * Collapses all selected directory nodes. If the selection is a single file or a single collapsed
   * directory, the selection is set to the directory's parent.
   */
  _collapseSelection(deep: boolean = false): void {
    const selectedNodes = this._store.getSelectedNodes();
    const firstSelectedNode = nullthrows(selectedNodes.first());
    if (
      selectedNodes.size === 1 &&
      !firstSelectedNode.isRoot &&
      !(firstSelectedNode.isContainer && firstSelectedNode.isExpanded)
    ) {
      /*
       * Select the parent of the selection if the following criteria are met:
       *   * Only 1 node is selected
       *   * The node is not a root
       *   * The node is not an expanded directory
      */

      const parent = nullthrows(firstSelectedNode.parent);
      this._selectAndTrackNode(parent);
    } else {
      selectedNodes.forEach(node => {
        // Only directories can be expanded. Skip non-directory nodes.
        if (!node.isContainer) {
          return;
        }

        if (deep) {
          this._actions.collapseNodeDeep(node.rootUri, node.uri);
        } else {
          this._actions.collapseNode(node.rootUri, node.uri);
        }
      });
    }
  }

  _selectAndTrackNode(node: FileTreeNode): void {
    this._actions.setSelectedNode(node.rootUri, node.uri);
  }

  _collapseAll(): void {
    const roots = this._store.roots;
    roots.forEach(root => this._actions.collapseNodeDeep(root.uri, root.uri));
  }

  _deleteSelection(): void {
    const nodes = this._store.getTargetNodes();
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
            this._actions.deleteSelectedNodes();
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
  }

  /**
   * Expands all selected directory nodes.
   */
  _expandSelection(deep: boolean): void {
    this._handleClearFilter();

    this._store.getSelectedNodes().forEach(node => {
      // Only directories can be expanded. Skip non-directory nodes.
      if (!node.isContainer) {
        return;
      }

      if (deep) {
        this._actions.expandNodeDeep(node.rootUri, node.uri);
        this._actions.setTrackedNode(node.rootUri, node.uri);
      } else {
        if (node.isExpanded) {
          // Node is already expanded; move the selection to the first child.
          let firstChild = node.children.first();
          if (firstChild != null && !firstChild.shouldBeShown) {
            firstChild = firstChild.findNextShownSibling();
          }

          if (firstChild != null) {
            this._selectAndTrackNode(firstChild);
          }
        } else {
          this._actions.expandNode(node.rootUri, node.uri);
          this._actions.setTrackedNode(node.rootUri, node.uri);
        }
      }
    });
  }

  _openSelectedEntry(): void {
    this._handleClearFilter();
    const singleSelectedNode = this._store.getSingleSelectedNode();
    // Only perform the default action if a single node is selected.
    if (singleSelectedNode != null) {
      this._actions.confirmNode(
        singleSelectedNode.rootUri,
        singleSelectedNode.uri,
      );
    }
  }

  _openSelectedEntrySplit(
    orientation: atom$PaneSplitOrientation,
    side: atom$PaneSplitSide,
  ): void {
    const singleSelectedNode = this._store.getSingleTargetNode();
    // Only perform the default action if a single node is selected.
    if (singleSelectedNode != null && !singleSelectedNode.isContainer) {
      // for: is this feature used enough to justify uncollapsing?
      track('filetree-split-file', {
        orientation,
        side,
      });
      this._actions.openSelectedEntrySplit(
        singleSelectedNode.uri,
        orientation,
        side,
      );
    }
  }

  _openSelectedEntrySplitUp(): void {
    this._openSelectedEntrySplit('vertical', 'before');
  }

  _openSelectedEntrySplitDown(): void {
    this._openSelectedEntrySplit('vertical', 'after');
  }

  _openSelectedEntrySplitLeft(): void {
    this._openSelectedEntrySplit('horizontal', 'before');
  }

  _openSelectedEntrySplitRight(): void {
    this._openSelectedEntrySplit('horizontal', 'after');
  }

  async _removeRootFolderSelection(): Promise<void> {
    const rootNode = this._store.getSingleSelectedNode();
    if (rootNode != null && rootNode.isRoot) {
      logger.info('Removing project path via file tree', rootNode);
      await removeProjectPath(rootNode.uri);
    }
  }

  _searchInDirectory(event: Event): void {
    const targetElement = ((event.target: any): HTMLElement);
    // If the event was sent to the entire tree, rather then a single element - attempt to derive
    // the path to work on from the current selection.
    if (targetElement.classList.contains('nuclide-file-tree')) {
      const node = this._store.getSingleSelectedNode();
      if (node == null) {
        return;
      }

      let path = node.uri;
      if (!node.isContainer) {
        invariant(node.parent);
        path = node.parent.uri;
      }

      // What we see here is an unfortunate example of "DOM as an API" paradigm :-(
      // Atom's handler for the "show-in-current-directory" command is context sensitive
      // and it derives the context from the custom "data-path" attribute. The attribute must
      // be present on a child of a closest element having a ".directory" class.
      // See: https://github.com/atom/find-and-replace/blob/v0.208.1/lib/project-find-view.js#L356-L360
      // We will just temporarily create a proper element for the event handler to work on
      // and remove it immediately afterwards.
      const temporaryElement = document.createElement('div');
      temporaryElement.classList.add('directory');
      const pathChild = document.createElement('div');
      pathChild.dataset.path = path;
      temporaryElement.appendChild(pathChild);

      // Must attach to the workspace-view, otherwise the handler won't be found
      const workspaceView = atom.views.getView(atom.workspace);
      workspaceView.appendChild(temporaryElement);

      atom.commands.dispatch(
        temporaryElement,
        'project-find:show-in-current-directory',
      );

      // Cleaning for the workspace-view
      workspaceView.removeChild(temporaryElement);
    } else {
      atom.commands.dispatch(
        targetElement,
        'project-find:show-in-current-directory',
      );
    }
  }

  _showInFileManager(event: Event): void {
    const path = getElementFilePath(((event.target: any): HTMLElement), true);
    if (path == null || nuclideUri.isRemote(path)) {
      return;
    }
    shell.showItemInFolder(path);
  }

  _copyFilenamesWithDir(event: Event): void {
    const nodes = this._store.getSelectedNodes();
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
  }

  _copyFullPath(event: Event): void {
    const path = getElementFilePath(((event.target: any): HTMLElement), true);
    if (path == null) {
      return;
    }
    const parsed = nuclideUri.parse(path);
    atom.clipboard.write(parsed.path);
  }

  destroy(): void {
    this._disposables.dispose();
    for (const disposable of this._disposableForRepository.values()) {
      disposable.dispose();
    }
    this._store.reset();
    this._contextMenu.dispose();
  }

  serialize(): ExportStoreData {
    return this._store.exportData();
  }
}
