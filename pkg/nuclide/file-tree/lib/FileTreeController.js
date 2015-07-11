'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var {fileTypeClass} = require('nuclide-atom-helpers');
var {CompositeDisposable, Disposable} = require('atom');
var Immutable = require('immutable');
var LazyFileTreeNode = require('./LazyFileTreeNode');
var {PanelController} = require('nuclide-panel');
var fs = require('fs-plus');
var path = require('path');
var shell = require('shell');
var {treeNodeTraversals, TreeRootComponent} = require('nuclide-ui-tree');
var React = require('react-for-atom');

var {addons} = React;

async function fetchChildren(node: LazyFileTreeNode, controller: FileTreeController): Promise<Immutable.List<LazyFileTreeNode>> {
  if (!node.isContainer()) {
    return Immutable.List.of();
  }

  var directory = node.getItem();
  var directoryEntries = await new Promise((resolve, reject) => {
    directory.getEntries((error, entries) => {
      // Resolve to an empty array if the directory deson't exist.
      if (error && error.code !== 'ENOENT') {
        reject(error);
      } else {
        resolve(entries || []);
      }
    });
  });

  var fileNodes = [];
  var directoryNodes = [];
  directoryEntries.forEach((entry) => {
    var childNode = controller.getNodeAndSetState(entry, /* parent */ node);
    if (entry.isDirectory()) {
      directoryNodes.push(childNode);
    } else if (entry.isFile()) {
      fileNodes.push(childNode);
    }
  });

  var newChildren = directoryNodes.concat(fileNodes);

  var cachedChildren = node.getCachedChildren();
  if (cachedChildren) {
    controller.destroyStateForOldNodes(cachedChildren, newChildren);
  }

  return new Immutable.List(newChildren);
}

function labelClassNameForNode(node: LazyFileTreeNode) {
  var classObj: {[className: string]: boolean} = {
    'icon': true,
    'name': true,
  };

  var iconClassName;
  if (node.isContainer()) {
    iconClassName = node.isSymlink()
      ? 'icon-file-symlink-directory'
      : 'icon-file-directory';
  } else if (node.isSymlink()) {
    iconClassName = 'icon-file-symlink-file';
  } else {
    iconClassName = fileTypeClass(node.getLabel());
  }
  classObj[iconClassName] = true;

  return addons.classSet(classObj);
}

function rowClassNameForNode(node: ?LazyFileTreeNode) {
  if (!node) {
    return '';
  }

  var vcsClassName = vcsClassNameForEntry(node.getItem());
  return addons.classSet({
    [vcsClassName]: vcsClassName,
  });
}

// TODO (t7337695) Make this function more efficient.
function vcsClassNameForEntry(entry: atom$File | atom$Directory): string {
  var path = entry.getPath();

  var className = '';
  var {repositoryContainsPath} = require('nuclide-hg-git-bridge');
  atom.project.getRepositories().every(function(repository: ?Repository) {
    if (!repository) {
      return true;
    }

    if (!repositoryContainsPath(repository, path)) {
      return true;
    }

    if (repository.isPathIgnored(path)) {
      className = 'status-ignored';
      return false;
    }

    var status = null;
    if (entry.isFile()) {
      status = repository.getCachedPathStatus(path);
    } else if (entry.isDirectory()) {
      status = repository.getDirectoryStatus(path);
    }

    if (status) {
      if (repository.isStatusNew(status)) {
        className = 'status-added';
      } else if (repository.isStatusModified(status)) {
        className = 'status-modified';
      }
      return false;
    }

    return true;
  }, this);
  return className;
}

function isLocalFile(entry: atom$File | atom$Directory): boolean {
  return entry.getLocalPath === undefined;
}

type FileTreeControllerState = {
  panel: PanelControllerState;
  tree: ?TreeComponentState;
};

type NodeState = {node: LazyFileTreeNode; subscription: ?Disposable};

var FileTree = React.createClass({
  render() {
    return (
      <div className="nuclide-file-tree" tabIndex="-1">
        <TreeRootComponent ref="root" {...this.props} />
      </div>
    );
  },

  getTreeRoot(): ?ReactComponent {
    return this.refs.root;
  },
});

class FileTreeController {
  _hostElement: ?Element;
  _keyToState: ?Map<string, NodeState>;
  _panelController: PanelController;
  _subscriptions: CompositeDisposable;

  constructor(state: ?FileTreeControllerState) {
    this._fetchChildrenWithController = (node) => fetchChildren(node, this);

    this._keyToState = new Map();

    this._subscriptions = new CompositeDisposable();
    this._repositorySubscriptions = null;

    this._subscriptions.add(new Disposable(() => {
      for (var nodeState of this._keyToState.values()) {
        if (nodeState.subscription) {
          nodeState.subscription.dispose();
        }
      }
      this._keyToState = null;
    }));

    var directories = atom.project.getDirectories();
    this._roots = directories.map(
        (directory) => this.getNodeAndSetState(directory, /* parent */ null));

    var eventHandlerSelector = '.nuclide-file-tree';

    this._subscriptions.add(atom.commands.add(
        eventHandlerSelector,
        {
          'core:backspace': () => this.deleteSelection(),
          'core:delete': () => this.deleteSelection(),
        }));

    var props: {[key: string]: mixed} = {
      initialRoots: this._roots,
      eventHandlerSelector,
      onConfirmSelection: this.onConfirmSelection.bind(this),
      onKeepSelection: this.onKeepSelection.bind(this),
      labelClassNameForNode,
      rowClassNameForNode,
      elementToRenderWhenEmpty: <div>No project root</div>,
    };
    if (state && state.tree) {
      props.initialExpandedNodeKeys = state.tree.expandedNodeKeys;
      props.initialSelectedNodeKeys = state.tree.selectedNodeKeys;
    }
    this._panelController = new PanelController(
        <FileTree {...props} />,
        {dock: 'left'},
        state && state.panel);

    this._subscriptions.add(atom.commands.add(
        eventHandlerSelector,
        {
          'nuclide-file-tree:add-file': () => this.openAddFileDialog(),
          'nuclide-file-tree:add-folder': () => this.openAddFolderDialog(),
          'nuclide-file-tree:delete-selection': () => this.deleteSelection(),
          'nuclide-file-tree:rename-selection': () => this.openRenameDialog(),
          'nuclide-file-tree:duplicate-selection': () => this.openDuplicateDialog(),
          'nuclide-file-tree:remove-project-folder-selection': () => this.removeRootFolderSelection(),
          'nuclide-file-tree:copy-full-path': () => this.copyFullPath(),
          'nuclide-file-tree:show-in-file-manager': () => this.showInFileManager(),
          'nuclide-file-tree:reload': () => this.reload(),
        }));

    this._subscriptions.add(atom.project.onDidChangePaths((paths) => {
      var treeComponent = this.getTreeComponent();
      if (treeComponent) {
        var newRoots = atom.project.getDirectories().map(
            (directory) => this.getNodeAndSetState(directory, /* parent */ null));
        this.destroyStateForOldNodes(this._roots, newRoots);
        this._roots = newRoots;
        treeComponent.setRoots(newRoots);

        if (this._repositorySubscriptions) {
          this._repositorySubscriptions.dispose();
        }
        this._repositorySubscriptions = new CompositeDisposable();
        var rootPaths = atom.project.getPaths();
        atom.project.getRepositories().forEach(function(repository: ?Repository) {
          if (repository) {
            this._repositorySubscriptions.add(repository.onDidChangeStatuses(() => {
              this.forceUpdate();
            }));
            if (repository.getStatuses) {
              // This method is available on HgRepositoryClient.
              // This will trigger a repository ::onDidChangeStatuses event if there
              // are modified files, and thus update the tree to reflect the
              // current version control "state" of the files.
              repository.getStatuses([repository.getProjectDirectory()]);
            }
          }
        }, this);
      }
    }));

    this.addContextMenuItemGroup([
      {
        label: 'New',
        submenu: [
          {
            label: 'File',
            command: 'nuclide-file-tree:add-file',
          },
          {
            label: 'Folder',
            command: 'nuclide-file-tree:add-folder',
          },
        ],
        // Show 'New' menu only when a single directory is selected so the
        // target is obvious and can handle a "new" object.
        shouldDisplayForSelectedNodes(nodes) {
          return nodes.length === 1 &&
            nodes.every(node => node.isContainer());
        },
      },
    ]);
    this.addContextMenuItemGroup([
      {
        label: 'Add Project Folder',
        command: 'application:add-project-folder',
        shouldDisplayIfTreeIsEmpty: true,
      },
      {
        label: 'Add Remote Project Folder',
        command: 'nuclide-remote-projects:connect',
        shouldDisplayIfTreeIsEmpty: true,
      },
      {
        label: 'Remove Project Folder',
        command: 'nuclide-file-tree:remove-project-folder-selection',
        shouldDisplayForSelectedNodes(nodes) {
          return nodes.length > 0 && nodes.every(node => node.isRoot());
        },
      },
    ]);
    this.addContextMenuItemGroup([
      {
        label: 'Rename',
        command: 'nuclide-file-tree:rename-selection',
        shouldDisplayForSelectedNodes(nodes) {
          return nodes.length === 1 && !nodes[0].isRoot();
        },
      },
      {
        label: 'Duplicate',
        command: 'nuclide-file-tree:duplicate-selection',
        shouldDisplayForSelectedNodes(nodes) {
          return nodes.length === 1 && !nodes[0].getItem().isDirectory();
        },
      },
      {
        label: 'Delete',
        command: 'nuclide-file-tree:delete-selection',
        shouldDisplayForSelectedNodes(nodes) {
          return nodes.length > 0 && !nodes.some(node => node.isRoot());
        },
      },
    ]);
    this.addContextMenuItemGroup([
      {
        label: 'Copy Full Path',
        command: 'nuclide-file-tree:copy-full-path',
        shouldDisplayForSelectedNodes(nodes) {
          return nodes.length === 1;
        },
      },
      {
        label: 'Show in Finder',
        command: 'nuclide-file-tree:show-in-file-manager',
        shouldDisplayForSelectedNodes(nodes) {
          // For now, this only works for local files on OS X.
          return (
            nodes.length === 1 &&
            isLocalFile(nodes[0].getItem()) &&
            process.platform === 'darwin'
          );
        },
      },
    ]);
    this.addContextMenuItemGroup([
      {
        label: 'Reload',
        command: 'nuclide-file-tree:reload',
      },
    ]);
  }

  destroy() {
    this._panelController.destroy();
    this._panelController = null;
    this._subscriptions.dispose();
    this._subscriptions = null;
    if (this._repositorySubscriptions) {
      this._repositorySubscriptions.dispose();
      this._repositorySubscriptions = null;
    }
    this._logger = null;
    if (this._hostElement) {
      this._hostElement.parentNode.removeChild(this._hostElement);
    }
    this._closeDialog();
  }

  toggle(): void {
    this._panelController.toggle();
  }

  setVisible(shouldBeVisible: boolean): void {
    this._panelController.setVisible(shouldBeVisible);
  }

  serialize(): FileTreeControllerState {
    var treeComponent = this.getTreeComponent();
    var tree = treeComponent ? treeComponent.serialize() : null;
    return {
      panel: this._panelController.serialize(),
      tree,
    };
  }

  forceUpdate(): void {
    var treeComponent = this.getTreeComponent();
    if (treeComponent) {
      treeComponent.forceUpdate();
    }
  }

  addContextMenuItemGroup(
    menuItemDefinitions: Array<TreeMenuItemDefinition>
  ): void {
    var treeComponent = this.getTreeComponent();
    if (treeComponent) {
      treeComponent.addContextMenuItemGroup(menuItemDefinitions);
    }
  }

  getTreeComponent(): ?TreeRootComponent {
    var component = this._panelController.getChildComponent();
    if (component && component.hasOwnProperty('getTreeRoot')) {
      return component.getTreeRoot();
    }
    return null;
  }

  /**
   * Returns the cached node for `entry` or creates a new one. It sets the appropriate bookkeeping
   * state if it creates a new node.
   */
  getNodeAndSetState(
    entry: atom$File | atom$Directory,
    parent: ?LazyFileTreeNode
  ): LazyFileTreeNode {
    // We need to create a node to get the path, even if we don't end up returning it.
    var node = new LazyFileTreeNode(entry, parent, this._fetchChildrenWithController);
    var nodeKey = node.getKey();

    // Reuse existing node if possible. This preserves the cached children and prevents
    // us from creating multiple file watchers on the same file.
    var state = this.getStateForNodeKey(nodeKey);
    if (state) {
      return state.node;
    }

    var subscription = null;
    if (entry.isDirectory()) {
      try {
        // this call fails because it could try to watch a non-existing directory,
        // or with a use that has no permission to it.
        subscription = entry.onDidChange(() => {
          node.invalidateCache();
          this.forceUpdate();
        });
      } catch (err) {
        this._logError('nuclide-file-tree: Cannot subscribe to a directory.', entry.getPath(), err);
      }
    }

    this._setStateForNodeKey(nodeKey, {node, subscription});

    return node;
  }

  _setStateForNodeKey(nodeKey: string, state: NodeState): void {
    this._destroyStateForNodeKey(nodeKey);
    this._keyToState.set(nodeKey, state);
  }

  getStateForNodeKey(nodeKey: string): ?NodeState {
    return this._keyToState.get(nodeKey);
  }

  /**
   * Destroys states for nodes that are in `oldNodes` and not in `newNodes`.
   * This is useful when fetching new children -- some cached nodes can still
   * be reused and the rest must be destroyed.
   */
  destroyStateForOldNodes(oldNodes: Array<LazyFileTreeNode>, newNodes: Array<LazyFileTreeNode>): void {
    var newNodesSet = new Set(newNodes);
    oldNodes.forEach((oldNode) => {
      if (!newNodesSet.has(oldNode)) {
        this._destroyStateForNodeKey(oldNode.getKey());
      }
    })
  }

  _destroyStateForNodeKey(nodeKey: string): void {
    var state = this.getStateForNodeKey(nodeKey);
    if (state) {
      var {node} = state;
      treeNodeTraversals.forEachCachedNode(node, (cachedNode) => {
        var cachedNodeKey = cachedNode.getKey();
        var cachedState = this.getStateForNodeKey(cachedNodeKey);
        if (cachedState) {
          if (cachedState.subscription) {
            cachedState.subscription.dispose();
          }
          this._keyToState.delete(cachedNodeKey);
        }
      });

      var treeComponent = this.getTreeComponent();
      if (treeComponent) {
        treeComponent.removeStateForSubtree(node);
      }
    }
  }

  onConfirmSelection(node: LazyFileTreeNode): void {
    var entry = node.getItem();
    atom.workspace.open(entry.getPath(), {
      activatePane: !atom.config.get('tabs.usePreviewTabs'),
      searchAllPanes: true,
    });
  }

  onKeepSelection(): void {
    if (!atom.config.get('tabs.usePreviewTabs')) {
      return;
    }

    var activePaneItem = atom.workspace.getActivePaneItem();
    atom.commands.dispatch(atom.views.getView(activePaneItem), 'tabs:keep-preview-tab');

    // "Activate" the already-active pane to give it focus.
    atom.workspace.getActivePane().activate();
  }

  removeRootFolderSelection(): void {
    var selectedItems = this._getSelectedItems();
    var selectedFilePaths = selectedItems.map((item) => item.getPath());
    var rootPathsSet = new Set(atom.project.getPaths());
    selectedFilePaths.forEach((selectedFilePath) => {
      if (rootPathsSet.has(selectedFilePath)) {
        atom.project.removePath(selectedFilePath);
      }
    });
  }

  copyFullPath(): void {
    var selectedItems = this._getSelectedItems();
    if (selectedItems.length !== 1) {
      this._logError('nuclide-file-tree: Exactly 1 item should be selected');
      return;
    }

    var selectedItem = selectedItems[0];
    // For remote files we want to copy the local path instead of full path.
    // i.e, "/home/dir/file" vs "nuclide:/host:port/home/dir/file"
    atom.clipboard.write(
      isLocalFile(selectedItem)
        ? selectedItem.getPath()
        : selectedItem.getLocalPath()
    );
  }

  showInFileManager(): void {
    var selectedItems = this._getSelectedItems();
    if (selectedItems.length !== 1) {
      return;
    }
    var filePath = selectedItems[0].getPath();

    if (process.platform === 'darwin') {
      var {asyncExecute} = require('nuclide-commons');
      asyncExecute('open', ['-R', filePath], /* options */ {});
    }
  }

  async revealActiveFile(): Promise<void> {
    var editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      return;
    }

    var treeComponent = this.getTreeComponent();
    if (treeComponent) {
      var {file} = editor.getBuffer();
      if (file) {
        var {find} = require('nuclide-commons').array;
        var filePath = file.getPath();
        var rootDirectory = find(atom.project.getDirectories(), directory => directory.contains(filePath));
        if (rootDirectory) {
          // Accumulate all the ancestor keys from the file up to the root.
          var directory = file.getParent();
          var ancestorKeys = [];
          while (rootDirectory.getPath() !== directory.getPath()) {
            ancestorKeys.push(new LazyFileTreeNode(directory).getKey());
            directory = directory.getParent();
          }
          ancestorKeys.push(new LazyFileTreeNode(rootDirectory).getKey());

          // Expand each node from the root down to the file.
          for (var nodeKey of ancestorKeys.reverse()) {
            try {
              // Select the node to ensure it's visible.
              await treeComponent.selectNodeKey(nodeKey);
              await treeComponent.expandNodeKey(nodeKey);
            } catch (error) {
              // If the node isn't in the tree, its descendants aren't either.
              return;
            }
          }

          try {
            await treeComponent.selectNodeKey(new LazyFileTreeNode(file).getKey());
          } catch (error) {
            // It's ok if the node isn't in the tree, so we can ignore the error.
            return;
          }
        }
      }
    }
    this.setVisible(true);
  }

  deleteSelection() {
    var treeComponent = this.getTreeComponent();
    if (!treeComponent) {
      return;
    }

    var selectedNodes = treeComponent.getSelectedNodes();
    if (selectedNodes.length === 0 || selectedNodes.some(node => node.isRoot())) {
      return;
    }
    var selectedItems = selectedNodes.map(node => node.getItem());

    var selectedPaths = selectedItems.map(entry => entry.getPath());
    var message = 'Are you sure you want to delete the selected ' +
        (selectedItems.length > 1 ? 'items' : 'item');
    atom.confirm({
      message,
      detailedMessage: 'You are deleting:\n' + selectedPaths.join('\n'),
      buttons: {
        'Delete': async () => {
          var deletePromises = [];
          selectedItems.forEach((entry, i) => {
            var entryPath = selectedPaths[i];
            if (entryPath.startsWith('nuclide:/')) {
              deletePromises.push(entry.delete());
            } else {
              // TODO(jjiaa): This special-case can be eliminated once `delete()`
              // is added to `Directory` and `File`.
              shell.moveItemToTrash(entryPath);
            }
          });

          await Promise.all(deletePromises);
          var parentDirectories = new Set(selectedItems.map((entry) => entry.getParent()));
          parentDirectories.forEach((directory) => this._reloadDirectory(directory));
        },
        'Cancel': null,
      },
    });
  }

  reload() {
    var treeComponent = this.getTreeComponent();
    if (!treeComponent) {
      return;
    }
    treeComponent.invalidateCachedNodes();
    treeComponent.forceUpdate();
  }

  _getSelectedItems(): Array<LazyFileTreeNode> {
    var treeComponent = this.getTreeComponent();
    if (!treeComponent) {
      return [];
    }

    var selectedNodes = treeComponent.getSelectedNodes();
    return selectedNodes.map((node) => node.getItem());
  }

  openAddFileDialog(): void {
    this._openAddDialog('file', async (rootDirectory: Directory, filePath: string) => {
      // Note: this will throw if the resulting path matches that of an existing
      // local directory.
      var newFile = rootDirectory.getFile(filePath);
      await newFile.create();
      atom.workspace.open(newFile.getPath());
      this._reloadDirectory(newFile.getParent());
    });
  }

  openAddFolderDialog(): void {
    this._openAddDialog('folder', async (rootDirectory: Directory, directoryPath: string) => {
      var newDirectory = rootDirectory.getSubdirectory(directoryPath);
      await newDirectory.create();
      this._reloadDirectory(newDirectory.getParent());
    });
  }

  _reloadDirectory(directory: atom$Directory): void {
    var directoryNode = this.getTreeComponent().getNodeForKey(new LazyFileTreeNode(directory).getKey());
    directoryNode.invalidateCache();
    this.forceUpdate();
  }

  _openAddDialog(
      entryType: string,
      onConfirm: (rootDirectory: atom$Directory, filePath: string) => Promise<void>) {
    var selection = this._getSelectedEntryAndDirectoryAndRoot();
    if (!selection) {
      return;
    }
    var message = (
      <div>
        <div>Enter the path for the new {entryType} in the root:</div>
        <div>{path.normalize(selection.root.getPath() + '/')}</div>
      </div>
    );

    var props = {
      rootDirectory: selection.root,
      initialEntry: selection.directory,
      initialDirectoryPath: selection.entry.getPath(),
      message,
      onConfirm,
      onClose: this._closeDialog.bind(this),
    };
    this._openDialog(props);
  }

  openRenameDialog(): void {
    var selection = this._getSelectedEntryAndDirectoryAndRoot();
    if (!selection) {
      return;
    }

    var entryType = selection.entry.isFile() ? 'file' : 'folder';
    var message = (
      <div>
        <div>Enter the new path for the {entryType} in the root:</div>
        <div>{path.normalize(selection.root.getPath() + '/')}</div>
      </div>
    );

    var {entry, root} = selection;

    var props = {
      rootDirectory: root,
      initialEntry: entry,
      message,
      onConfirm: async (rootDirectory, relativeFilePath) => {
        if (isLocalFile(entry)) {
          // TODO(jjiaa): This special-case can be eliminated once `delete()`
          // is added to `Directory` and `File`.
          await new Promise((resolve, reject) => {
            fs.move(
                entry.getPath(),
                // Use `resolve` to strip trailing slashes because renaming a
                // file to a name with a trailing slash is an error.
                path.resolve(
                  path.join(rootDirectory.getPath(), relativeFilePath)
                ),
                error => error ? reject(error) : resolve());
          });
        } else {
          await entry.rename(path.join(rootDirectory.getLocalPath(), relativeFilePath));
        }
        this._reloadDirectory(entry.getParent());
      },
      onClose: () => this._closeDialog(),
      shouldSelectBasename: true,
    };
    this._openDialog(props);
  }

  openDuplicateDialog(): void {
    var selection = this._getSelectedEntryAndDirectoryAndRoot();
    var selectedItems = this._getSelectedItems();
    if (!selection || selectedItems.length > 1 || selection.entry.isDirectory()) {
      return;
    }

    var message = (
      <div>
        <div>Enter the new name for the file in the root:</div>
        <div>{path.normalize(selection.root.getPath() + '/')}</div>
      </div>
    );

    var {entry, root} = selection;
    var pathObject = path.parse(root.relativize(entry.getPath()));

    // entry.getBaseName() + _copy e.g FileTreeController_copy.js
    var newEntryPath = path.format({...pathObject, base: `${pathObject.name}_copy${pathObject.ext}`})
    var props = {
      rootDirectory: root,
      initialEntry: root.getFile(newEntryPath),
      message,
      onConfirm: async (rootDirectory, relativeFilePath) => {
        var treeComponent = this.getTreeComponent();
        var file = rootDirectory.getFile(relativeFilePath);
        var createdSuccessfully = await file.create();
        if(createdSuccessfully) {
          await entry.read().then(text => file.write(text));
          this._reloadDirectory(entry.getParent());
          atom.workspace.open(file.getPath());
          if(treeComponent) {
            treeComponent.selectNodeKey(new LazyFileTreeNode(file).getKey());
          }
        } else {
          atom.notifications.addWarning(
            "Failed to duplicate file",
            {
              dismissable: true,
              detail: `There was a problem duplicating the file. Please check if the file "${file.getBaseName()}" already exists.`
            }
          );
        }
      },
      onClose: () => this._closeDialog(),
      shouldSelectBasename: true,
    };
    this._openDialog(props);
  }


  _openDialog(props: object): void {
    var FileDialogComponent = require('./FileDialogComponent');
    this._closeDialog();

    this._hostElement = document.createElement('div');
    var workspaceEl = atom.views.getView(atom.workspace);
    workspaceEl.appendChild(this._hostElement);
    this._dialogComponent = React.render(<FileDialogComponent {...props} />, this._hostElement);
  }

  _closeDialog() {
    if (this._dialogComponent && this._dialogComponent.isMounted()) {
      React.unmountComponentAtNode(this._hostElement);
      this._dialogComponent = null;
      atom.views.getView(atom.workspace).removeChild(this._hostElement);
      this._hostElement = null;
    }
  }

  /**
   * Returns an object with the following properties:
   * - entry: The selected file or directory.
   * - directory: The selected directory or its parent if the selection is a file.
   * - root: The root directory containing the selected entry.
   *
   * The entry defaults to the first root directory if nothing is selected.
   * Returns null if some of the returned properties can't be populated.
   *
   * This is useful for populating the file dialogs.
   */
  _getSelectedEntryAndDirectoryAndRoot(
  ): ?{
    entry: atom$File | atom$Directory;
    directory: atom$Directory;
    root: ?atom$Directory
  } {
    var treeComponent = this.getTreeComponent();
    if (!treeComponent) {
      this._logError('nuclide-file-tree: Cannot get the directory for the selection because no file tree exists.');
      return null;
    }

    var entry = null;
    var selectedNodes = treeComponent.getSelectedNodes();
    if (selectedNodes.length > 0) {
      entry = selectedNodes[0].getItem();
    } else {
      var rootDirectories = atom.project.getDirectories();
      if (rootDirectories.length > 0) {
        entry = rootDirectories[0];
      } else {
        // We shouldn't be able to reach this error because it should only be
        // accessible from a context menu. If there's a context menu, there must
        // be at least one root folder with a descendant that's right-clicked.
        this._logError('nuclide-file-tree: Could not find a directory to add to.');
        return null;
      }
    }

    return {
      entry,
      directory: (entry && entry.isFile()) ? entry.getParent() : entry,
      root: this._getRootDirectory(entry),
    };
  }

  /**
   * Returns the workspace root directory for the entry, or the entry's parent.
   */
  _getRootDirectory(entry: atom$File | atom$Directory): ?atom$Directory {
    if (!entry) {
      return null;
    }
    var rootDirectoryOfEntry = null;
    var entryPath = entry.getPath();
    atom.project.getDirectories().some((directory) => {
      // someDirectory.contains(someDirectory.getPath()) returns false, so
      // we also have to check for the equivalence of the path.
      if (directory.contains(entryPath) || directory.getPath() === entryPath) {
        rootDirectoryOfEntry = directory;
        return true;
      }
      return false;
    });

    if (!rootDirectoryOfEntry) {
      rootDirectoryOfEntry = entry.getParent();
    }

    return rootDirectoryOfEntry;
  }

  _logError(errorMessage: string): void {
    if (!this._logger) {
      this._logger = require('nuclide-logging').getLogger();
    }
    this._logger.error(errorMessage);
  }
}

module.exports = FileTreeController;
