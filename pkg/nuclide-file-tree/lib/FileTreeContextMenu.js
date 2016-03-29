'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {CompositeDisposable} from 'atom';
import {EVENT_HANDLER_SELECTOR} from './FileTreeConstants';
import FileTreeStore from './FileTreeStore';

import path from 'path';

type MenuItemSingle = {
  label: string;
  command: string;
  shouldDisplay?: () => boolean;
};

type MenuItemGroup = {
  label: string;
  submenu: Array<MenuItemDefinition>;
  shouldDisplay?: () => boolean;
};

type MenuItemSeparator = {
  type: string;
};

type MenuItemDefinition = MenuItemSingle | MenuItemGroup | MenuItemSeparator;

class FileTreeContextMenu {
  _store: FileTreeStore;
  _subscriptions: CompositeDisposable;

  constructor() {
    this._subscriptions = new CompositeDisposable();
    this._store = FileTreeStore.getInstance();
    this._addContextMenuItemGroup([
      {
        label: 'Set to Current Working Root',
        command: 'nuclide-file-tree:set-current-working-root',
        shouldDisplay: () => {
          const node = this._store.getSingleSelectedNode();
          return node != null && node.isRoot && this._store.hasCwd() && !node.isCwd();
        },
      },
      {
        label: 'Split',
        shouldDisplay: () => {
          const node = this._store.getSingleSelectedNode();
          return node != null && !node.isContainer;
        },
        submenu: [
          {
            'label': 'Up',
            'command': 'nuclide-file-tree:open-selected-entry-up',
          },
          {
            'label': 'Down',
            'command': 'nuclide-file-tree:open-selected-entry-down',
          },
          {
            'label': 'Left',
            'command': 'nuclide-file-tree:open-selected-entry-left',
          },
          {
            'label': 'Right',
            'command': 'nuclide-file-tree:open-selected-entry-right',
          },
        ],
      },
    ]);
    this._addContextMenuItemGroup([
      {
        label: 'New',
        shouldDisplay: () => {
          return this._store.getSelectedKeys().size > 0;
        },
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
      },
    ]);
    this._addContextMenuItemGroup([
      {
        label: 'Add Project Folder',
        command: 'application:add-project-folder',
      },
      {
        label: 'Add Remote Project Folder',
        command: 'nuclide-remote-projects:connect',
      },
      {
        label: 'Remove Project Folder',
        command: 'nuclide-file-tree:remove-project-folder-selection',
        shouldDisplay: () => {
          const node = this._store.getSingleSelectedNode();
          return node != null && node.isRoot;
        },
      },
    ]);
    this._addContextMenuItemGroup([
      {
        label: 'Rename',
        command: 'nuclide-file-tree:rename-selection',
        shouldDisplay: () => {
          const node = this._store.getSingleSelectedNode();
          // For now, rename does not apply to root nodes.
          return node != null && !node.isRoot;
        },
      },
      {
        label: 'Duplicate',
        command: 'nuclide-file-tree:duplicate-selection',
        shouldDisplay: () => {
          const node = this._store.getSingleSelectedNode();
          return node != null && !node.isContainer;
        },
      },
      {
        label: 'Delete',
        command: 'nuclide-file-tree:remove',
        shouldDisplay: () => {
          const nodes = this._store.getSelectedNodes();
          // We can delete multiple nodes as long as no root node is selected
          return nodes.size > 0 && nodes.every(node => !node.isRoot);
        },
      },
    ]);
    this._addContextMenuItemGroup([
      {
        label: 'Copy Full Path',
        command: 'nuclide-file-tree:copy-full-path',
        shouldDisplay: () => {
          const node = this._store.getSingleSelectedNode();
          return node != null;
        },
      },
      {
        label: 'Show in Finder', // Mac OS X
        command: 'nuclide-file-tree:show-in-file-manager',
        shouldDisplay: this._shouldDisplayShowInFileManager.bind(this, 'darwin'),
      },
      {
        label: 'Show in Explorer', // Windows
        command: 'nuclide-file-tree:show-in-file-manager',
        shouldDisplay: this._shouldDisplayShowInFileManager.bind(this, 'win32'),
      },
      {
        label: 'Show in File Manager', // Linux
        command: 'nuclide-file-tree:show-in-file-manager',
        shouldDisplay: this._shouldDisplayShowInFileManager.bind(this, 'linux'),
      },
      {
        label: 'Search in Directory',
        command: 'nuclide-file-tree:search-in-directory',
        shouldDisplay: () => {
          const nodes = this._store.getSelectedNodes();
          return nodes.size > 0 && nodes.every(node => node.isContainer);
        },
      },
    ]);
  }

  dispose(): void {
    this._subscriptions.dispose();
  }

  _addContextMenuItemGroup(menuItems: Array<MenuItemDefinition>): void {
    // Atom is smart about only displaying a separator when there are items to
    // separate, so there will never be a dangling separator at the end.
    menuItems = menuItems.concat([{type: 'separator'}]);
    // TODO: Use a computed property when supported by Flow.
    const contextMenu = {};
    contextMenu[EVENT_HANDLER_SELECTOR] = menuItems;
    this._subscriptions.add(atom.contextMenu.add(contextMenu));
  }

  /**
   * @return A {boolean} whether the "Show in File Manager" context menu item should be displayed
   * for the current selection and the given `platform`.
   */
  _shouldDisplayShowInFileManager(platform: string): boolean {
    const node = this._store.getSingleSelectedNode();
    return (
      node != null &&
      path.isAbsolute(node.nodePath) &&
      process.platform === platform
    );
  }
}

module.exports = FileTreeContextMenu;
