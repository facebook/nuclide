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

import type Immutable from 'immutable';
import type {FileTreeContextMenuNode, Store} from './types';

import ContextMenu from 'nuclide-commons-atom/ContextMenu';
import getElementFilePath from 'nuclide-commons-atom/getElementFilePath';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nullthrows from 'nullthrows';
import {
  EVENT_HANDLER_SELECTOR,
  OPEN_FILES_MENU_SELECTOR,
  COMMANDS_SELECTOR,
} from './FileTreeConstants';
import * as FileTreeHelpers from '../../nuclide-file-tree/lib/FileTreeHelpers';
import * as Selectors from './redux/Selectors';

import nuclideUri from 'nuclide-commons/nuclideUri';

type MenuItemSingle = {
  +label: string,
  +command: string,
  shouldDisplay?: (event: MouseEvent) => boolean,
};

type MenuItemGroup = {
  +label: string,
  +submenu: Array<atom$ContextMenuItem>,
  shouldDisplay?: (event: MouseEvent) => boolean,
};

type MenuItemSeparator = {
  +type: string,
};

type MenuItemDefinition = MenuItemSingle | MenuItemGroup | MenuItemSeparator;

// It's just atom$ContextMenuItem with an optional `callback` property added.
// I wish flow would let add it in a more elegant way.
type AtomContextMenuItemWithCallback = {
  command?: string,
  callback?: () => mixed,
  created?: (event: MouseEvent) => void,
  enabled?: boolean,
  label?: string,
  shouldDisplay?: (event: MouseEvent) => boolean,
  submenu?: Array<atom$ContextMenuItem>,
  type?: string,
  visible?: boolean,
};

export type FileTreeContextMenuItem =
  | atom$ContextMenuItem
  | AtomContextMenuItemWithCallback;

const PRIORITY_GROUP_SIZE = 1000;
const PRIORITY_GROUP_SEPARATOR_OFFSET = PRIORITY_GROUP_SIZE - 1;

const WORKING_ROOT_PRIORITY = 0;
const NEW_MENU_PRIORITY = 1000;
const ADD_PROJECT_MENU_PRIORITY = 2000;
const SOURCE_CONTROL_MENU_PRIORITY = 3000;
const MODIFY_FILE_MENU_PRIORITY = 4000;
const SPLIT_MENU_PRIORITY = 5000;
const TEST_SECTION_PRIORITY = 6000;
const SHOW_IN_MENU_PRIORITY = 7000;

/**
 * This context menu wrapper exists to address some of the limitations in the ContextMenuManager:
 * https://atom.io/docs/api/latest/ContextMenuManager.
 *
 * Specifically, a context menu item would often like to know which file (or directory) the user
 * right-clicked on in the file tree when selecting the menu item. The fundamental problem is that
 * the way a menu item is notified that it was selected is that the Atom command associated with
 * the item is fired. By the time the function associated with the command is called, the state
 * with which the menu item was created is lost. Here we introduce a pattern where the callback
 * registered with the command can get the selection via the FileTreeContextMenu:
 * ```
 * // Subscribe to the nuclide-file-tree.context-menu service by ensuring the package.json for your
 * // Atom package contains the following stanza:
 * "consumedServices": {
 *   "nuclide-file-tree.context-menu": {
 *     "versions": {
 *       "0.1.0": "addItemsToFileTreeContextMenu"
 *     }
 *   }
 * },
 *
 * // Include the following in the main.js file for your package:
 * import {CompositeDisposable, Disposable} from 'atom';
 * import invariant from 'assert';
 *
 * let disposables: ?UniversalDisposable = null;
 *
 * export function activate(state: ?Object): void {
 *   disposables = new UniversalDisposable();
 * }
 *
 * export function deactivate(): void {
 *   if (disposables != null) {
 *     disposables.dispose();
 *     disposables = null;
 *   }
 * }
 *
 * export function addItemsToFileTreeContextMenu(contextMenu: FileTreeContextMenu): IDisposable {
 *   invariant(disposables);
 *
 *   const contextDisposable = contextMenu.addItemToSourceControlMenu(
 *     {
 *       label: 'Label for the menu item that acts on a file',
 *       command: 'command-that-should-only-be-fired-from-the-context-menu',
 *       // If the callback below is given a new atom command with the given name will be
 *       // automatically registered. You can omit it if you prefer to register the command
 *       // manually.
 *       callback() {
 *         Array.from(contextMenu.getSelectedNodes())
 *           .filter(node => !node.isContainer)
 *           .forEach((node: FileTreeContextMenuNode) => {
 *             const uri = node.uri;
 *             // DO WHAT YOU LIKE WITH THE URI!
 *           });
 *       },
 *       shouldDisplay() {
 *         return Array.from(contextMenu.getSelectedNodes()).some(node => !node.isContainer);
 *       },
 *     },
 *     1000, // priority
 *   );
 *
 *   disposables.add(contextDisposable);
 *   return new Disposable(() => {
 *     invariant(disposables);
 *     if (disposables != null) {
 *       disposables.remove(contextDisposable);
 *     }
 *   });
 * }
 * ```
 */
export default class FileTreeContextMenu {
  _contextMenu: ContextMenu;
  _openFilesMenu: ContextMenu;
  _newMenu: ContextMenu;
  _sourceControlMenu: ContextMenu;
  _store: Store;
  _disposables: UniversalDisposable;

  constructor(store: Store) {
    this._contextMenu = new ContextMenu({
      type: 'root',
      cssSelector: EVENT_HANDLER_SELECTOR,
    });
    this._disposables = new UniversalDisposable();
    this._store = store;
    this._disposables.add(this._contextMenu);

    const shouldDisplaySetToCurrentWorkingRootOption = () => {
      const node = this.getSingleSelectedNode();
      return (
        node != null &&
        node.isContainer &&
        Selectors.hasCwd(this._store.getState()) &&
        !node.isCwd
      );
    };

    this._addContextMenuItemGroup(
      [
        {
          label: 'Set to Current Working Root',
          command: 'tree-view:set-current-working-root',
          after: [
            'project-find:show-in-current-directory',
            'tree-view:search-in-directory',
          ],
          shouldDisplay: shouldDisplaySetToCurrentWorkingRootOption,
        },
      ],
      WORKING_ROOT_PRIORITY,
      this._contextMenu,
    );

    this._openFilesMenu = new ContextMenu({
      type: 'root',
      cssSelector: OPEN_FILES_MENU_SELECTOR,
    });
    this._disposables.add(this._openFilesMenu);

    this._newMenu = new ContextMenu({
      type: 'submenu',
      label: 'New',
      parent: this._contextMenu,
      shouldDisplay: (e: MouseEvent) => {
        return Selectors.getSingleSelectedNode(this._store.getState()) != null;
      },
    });
    this._newMenu.addItem({label: 'File', command: 'tree-view:add-file'}, 0);
    this._newMenu.addItem(
      {label: 'Folder', command: 'tree-view:add-folder'},
      1,
    );
    this._contextMenu.addSubmenu(this._newMenu, NEW_MENU_PRIORITY);
    this._contextMenu.addItem({type: 'separator'}, NEW_MENU_PRIORITY + 1);
    this._disposables.add(this._newMenu);

    this._addContextMenuItemGroup(
      [
        {
          label: 'Add Folder',
          command: 'application:add-project-folder',
        },
        {
          label: 'Add Remote Folder',
          command: 'nuclide-remote-projects:connect',
        },
        {
          label: 'Remove Folder',
          command: 'tree-view:remove-project-folder-selection',
          shouldDisplay: () => {
            const node = this.getSingleSelectedNode();
            return node != null && node.isRoot;
          },
        },
      ],
      ADD_PROJECT_MENU_PRIORITY,
      this._contextMenu,
    );

    this._sourceControlMenu = new ContextMenu({
      type: 'submenu',
      label: 'Source Control',
      parent: this._contextMenu,
      shouldDisplay: (e: MouseEvent) => {
        return (
          !this._sourceControlMenu.isEmpty() &&
          !this.getSelectedNodes().isEmpty()
        );
      },
    });
    this._contextMenu.addSubmenu(
      this._sourceControlMenu,
      SOURCE_CONTROL_MENU_PRIORITY,
    );
    this._contextMenu.addItem(
      {
        type: 'separator',
        shouldDisplay: (e: MouseEvent) => !this._sourceControlMenu.isEmpty(),
      },
      SOURCE_CONTROL_MENU_PRIORITY + 1,
    );
    this._openFilesMenu.addSubmenu(
      this._sourceControlMenu,
      SOURCE_CONTROL_MENU_PRIORITY,
    );
    this._openFilesMenu.addItem(
      {
        type: 'separator',
        shouldDisplay: (e: MouseEvent) => !this._sourceControlMenu.isEmpty(),
      },
      SOURCE_CONTROL_MENU_PRIORITY + 1,
    );
    this._disposables.add(this._sourceControlMenu);

    const fileSystemItems = [
      {
        label: 'Rename',
        command: 'tree-view:rename-selection',
        shouldDisplay: () => {
          const node = this.getSingleSelectedNode();
          // For now, rename does not apply to root nodes.
          return node != null && !node.isRoot;
        },
      },
      {
        label: 'Duplicate',
        command: 'tree-view:duplicate-selection',
        shouldDisplay: () => {
          const nodes = this.getSelectedNodes();
          return (
            nodes.size > 0 &&
            nodes.every(node => node != null && !node.isContainer)
          );
        },
      },
      {
        label: 'Copy',
        command: 'tree-view:copy-selection',
        shouldDisplay: () => {
          const nodes = this.getSelectedNodes();
          if (nodes.isEmpty()) {
            return false;
          }
          const dirKey = FileTreeHelpers.getParentKey(
            nullthrows(nodes.first()).uri,
          );
          return nodes.every(
            n => FileTreeHelpers.getParentKey(n.uri) === dirKey,
          );
        },
      },
      {
        label: 'Paste',
        command: 'tree-view:paste-selection',
        shouldDisplay: () => {
          const cbMeta = atom.clipboard.readWithMetadata().metadata;
          if (
            cbMeta == null ||
            typeof cbMeta !== 'object' ||
            cbMeta.directory == null
          ) {
            return false;
          }
          const oldDir = cbMeta.directory;
          const node = this.getSingleSelectedNode();
          return (
            typeof oldDir === 'string' &&
            node != null &&
            // only offer paste to same filesystem
            nuclideUri.getHostnameOpt(node.uri) ===
              nuclideUri.getHostnameOpt(oldDir)
          );
        },
      },
      {
        label: 'Delete',
        command: 'tree-view:remove',
        shouldDisplay: () => {
          const nodes = this.getSelectedNodes();
          // We can delete multiple nodes as long as no root node is selected
          return (
            nodes.size > 0 && nodes.every(node => node != null && !node.isRoot)
          );
        },
      },
    ];

    this._addContextMenuItemGroup(
      fileSystemItems,
      MODIFY_FILE_MENU_PRIORITY,
      this._contextMenu,
    );
    this._addContextMenuItemGroup(
      fileSystemItems,
      MODIFY_FILE_MENU_PRIORITY,
      this._openFilesMenu,
    );

    const splitItems = [
      {
        label: 'Split',
        shouldDisplay: () => {
          const node = this.getSingleSelectedNode();
          return node != null && !node.isContainer;
        },
        submenu: [
          {
            label: 'Up',
            command: 'tree-view:open-selected-entry-up',
          },
          {
            label: 'Down',
            command: 'tree-view:open-selected-entry-down',
          },
          {
            label: 'Left',
            command: 'tree-view:open-selected-entry-left',
          },
          {
            label: 'Right',
            command: 'tree-view:open-selected-entry-right',
          },
        ],
      },
    ];

    this._addContextMenuItemGroup(
      splitItems,
      SPLIT_MENU_PRIORITY,
      this._contextMenu,
    );
    this._addContextMenuItemGroup(
      splitItems,
      SPLIT_MENU_PRIORITY,
      this._openFilesMenu,
    );

    // Add the "Show in X" menu group. There's a bit of hackery going on here: we want these items
    // to be applied to anyhing that matches our CSS selector, but we also want them to occur in a
    // specific order in the file tree context menu. Since `atom.contextMenu` doesn't support
    // priority, we add them twice. Ideally, these menu items wouldn't be in the file tree package
    // at all, but for historical reasons they are. Someday maybe we can pull them out.
    const showInXItems = [
      // $FlowFixMe (v0.54.1 <)
      {
        label: 'Copy Full Path',
        command: 'file:copy-full-path',
        shouldDisplay: event =>
          getElementFilePath(((event.target: any): HTMLElement)) != null,
      },
      // $FlowFixMe (v0.54.1 <)
      {
        label: `Show in ${getFileManagerName()}`,
        command: 'file:show-in-file-manager',
        after: ['file:copy-full-path'],
        before: [
          'project-find:show-in-current-directory',
          'tree-view:search-in-directory',
        ],
        shouldDisplay: event => {
          const path = getElementFilePath(((event.target: any): HTMLElement));
          return path != null && !nuclideUri.isRemote(path);
        },
      },
      // $FlowFixMe (v0.54.1 <)
      {
        // Note: This can be superceeded by
        // `project-find:show-in-current-directory` from
        // https://github.com/atom/find-and-replace
        label: 'Search in Directory',
        command: 'tree-view:search-in-directory',
        shouldDisplay: () => {
          const nodes = this.getSelectedNodes();
          return nodes.size > 0 && nodes.every(node => node.isContainer);
        },
      },
    ];

    this._disposables.add(
      atom.contextMenu.add({
        'atom-text-editor, [data-path]:not(.nuclide-file-tree-path)': showInXItems,
      }),
    );
    this._addContextMenuItemGroup(
      showInXItems,
      SHOW_IN_MENU_PRIORITY,
      this._contextMenu,
    );
    this._addContextMenuItemGroup(
      showInXItems,
      SHOW_IN_MENU_PRIORITY,
      this._openFilesMenu,
    );
  }

  /**
   * @param priority must be an integer in the range [0, 1000).
   */
  addItemToTestSection(
    originalItem: FileTreeContextMenuItem,
    priority: number,
  ): IDisposable {
    if (priority < 0 || priority >= PRIORITY_GROUP_SIZE) {
      throw new Error(`Illegal priority value: ${priority}`);
    }

    const disposable = new UniversalDisposable();
    disposable.add(
      this._addItemToMenu(
        originalItem,
        this._contextMenu,
        TEST_SECTION_PRIORITY + priority,
      ),
      this._addItemToMenu(
        originalItem,
        this._openFilesMenu,
        TEST_SECTION_PRIORITY + priority,
      ),
    );
    return disposable;
  }

  /**
   * @param priority must be an integer in the range [0, 1000).
   */
  addItemToProjectMenu(
    originalItem: FileTreeContextMenuItem,
    priority: number,
  ): IDisposable {
    if (priority < 0 || priority >= PRIORITY_GROUP_SIZE) {
      throw new Error(`Illegal priority value: ${priority}`);
    }

    return this._addItemToMenu(
      originalItem,
      this._contextMenu,
      ADD_PROJECT_MENU_PRIORITY + priority,
    );
  }

  /**
   * @param priority must be an integer in the range [0, 1000).
   */
  addItemToModifyFileMenu(
    originalItem: FileTreeContextMenuItem,
    priority: number,
  ): IDisposable {
    if (priority < 0 || priority >= PRIORITY_GROUP_SIZE) {
      throw new Error(`Illegal priority value: ${priority}`);
    }

    return this._addItemToMenu(
      originalItem,
      this._contextMenu,
      MODIFY_FILE_MENU_PRIORITY + priority,
    );
  }

  addItemToNewMenu(
    originalItem: FileTreeContextMenuItem,
    priority: number,
  ): IDisposable {
    return this._addItemToMenu(originalItem, this._newMenu, priority);
  }

  addItemToSourceControlMenu(
    originalItem: FileTreeContextMenuItem,
    priority: number,
  ): IDisposable {
    return this._addItemToMenu(originalItem, this._sourceControlMenu, priority);
  }

  addItemToOpenFilesMenu(
    originalItem: FileTreeContextMenuItem,
    priority: number,
  ): IDisposable {
    return this._addItemToMenu(originalItem, this._openFilesMenu, priority);
  }

  /**
   * @param priority must be an integer in the range [0, 1000).
   */
  addItemToShowInSection(
    originalItem: FileTreeContextMenuItem,
    priority: number,
  ): IDisposable {
    if (priority < 0 || priority >= PRIORITY_GROUP_SIZE) {
      throw new Error(`Illegal priority value: ${priority}`);
    }

    const disposable = new UniversalDisposable();
    disposable.add(
      this._addItemToMenu(
        originalItem,
        this._contextMenu,
        SHOW_IN_MENU_PRIORITY + priority,
      ),
      this._addItemToMenu(
        originalItem,
        this._openFilesMenu,
        SHOW_IN_MENU_PRIORITY + priority,
      ),
    );
    return disposable;
  }

  _addItemToMenu(
    originalItem: FileTreeContextMenuItem,
    menu: ContextMenu,
    priority: number,
  ): IDisposable {
    const {itemDisposable, item} = initCommandIfPresent(originalItem);
    itemDisposable.add(menu.addItem(item, priority));

    this._disposables.add(itemDisposable);
    return new UniversalDisposable(() => {
      this._disposables.remove(itemDisposable);
      itemDisposable.dispose();
    });
  }

  getSelectedNodes(): Immutable.List<FileTreeContextMenuNode> {
    const state = this._store.getState();
    return Selectors.getTargetNodes(state).map(node =>
      nullthrows(Selectors.getFileTreeContextMenuNode(state)(node)),
    );
  }

  getSingleSelectedNode(): ?FileTreeContextMenuNode {
    const state = this._store.getState();
    return Selectors.getFileTreeContextMenuNode(state)(
      Selectors.getSingleTargetNode(state),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  _addContextMenuItemGroup(
    menuItems: Array<MenuItemDefinition>,
    priority_: number,
    menu: ContextMenu,
  ): void {
    let priority = priority_;

    // $FlowFixMe: The conversion between MenuItemDefinition and atom$ContextMenuItem is a mess.
    menuItems.forEach(item => menu.addItem(item, ++priority));

    // Atom is smart about only displaying a separator when there are items to
    // separate, so there will never be a dangling separator at the end.
    menu.addItem(
      {type: 'separator'},
      priority_ + PRIORITY_GROUP_SEPARATOR_OFFSET,
    );
  }

  /**
   * @return A {boolean} whether the "Show in File Manager" context menu item should be displayed
   * for the current selection and the given `platform`.
   */
  _shouldDisplayShowInFileManager(event: Event, platform: string): boolean {
    const path = getElementFilePath(((event.target: any): HTMLElement));
    return (
      path != null &&
      nuclideUri.isAbsolute(path) &&
      process.platform === platform
    );
  }
}

function initCommandIfPresent(
  item: FileTreeContextMenuItem,
): {
  itemDisposable: UniversalDisposable,
  item: atom$ContextMenuItem,
} {
  const itemDisposable = new UniversalDisposable();
  if (typeof item.callback === 'function' && item.label != null) {
    // flowlint-next-line sketchy-null-string:off
    const command = item.command || generateNextInternalCommand(item.label);
    itemDisposable.add(
      atom.commands.add(COMMANDS_SELECTOR, command, item.callback),
    );
    return {itemDisposable, item: {...item, command}};
  }

  return {itemDisposable, item};
}

let nextInternalCommandId = 0;

function generateNextInternalCommand(itemLabel: string): string {
  const cmdName =
    itemLabel.toLowerCase().replace(/[^\w]+/g, '-') +
    '-' +
    nextInternalCommandId++;
  return `tree-view:${cmdName}`;
}

function getFileManagerName(): string {
  switch (process.platform) {
    case 'darwin':
      return 'Finder';
    case 'win32':
      return 'Explorer';
    default:
      return 'File Manager';
  }
}
