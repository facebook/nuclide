/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import invariant from 'assert';

import FileTreeContextMenu from '../lib/FileTreeContextMenu';
import {EVENT_HANDLER_SELECTOR} from '../lib/FileTreeConstants';
import waitsFor from '../../../jest/waits_for';
import createStore from '../lib/redux/createStore';
import type {FileTreeContextMenuItem} from '../lib/FileTreeContextMenu';

describe('FileTreeContextMenu', () => {
  let menu: FileTreeContextMenu;

  beforeEach(async () => {
    const store = createStore();
    menu = new FileTreeContextMenu(store);
    await waitsFor(() => fileTreeItemsOrNull() != null);
  });

  afterEach(() => {
    menu.dispose();
  });

  it('updates atom.contextMenu', () => {
    const items = fileTreeItems();
    expect(items.some(x => x.label === 'New')).toBeTruthy();
  });

  it('removes items on dispose and allows multiple dispose calls', () => {
    menu.dispose();
    const items = fileTreeItemsOrNull();
    expect(items).toBeNull();
  });

  it('puts ShowIn items in the same group', () => {
    const groups = itemGroups(fileTreeItems());
    expect(groups.get('Copy Full Path')).toBe(
      groups.get('Search in Directory'),
    );
  });

  it('has separators between groups', () => {
    const groups = itemGroups(fileTreeItems());
    const distinct = [
      getNonNull(groups, 'New'),
      getNonNull(groups, 'Add Folder'),
      getNonNull(groups, 'Rename'),
      getNonNull(groups, 'Split'),
      getNonNull(groups, 'Copy Full Path'),
    ];
    expect(new Set(distinct).size).toEqual(distinct.length);
  });

  it('includes Source Control submenu on demand', async () => {
    function includesSourceControl(): boolean {
      return fileTreeItems().some(x => x.label === 'Source Control');
    }
    expect(includesSourceControl()).toBeFalsy();
    menu.addItemToSourceControlMenu(testItem(), 100);
    await waitsFor(() => includesSourceControl());
  });

  it('supports addItemToShowInSection', async () => {
    const item = testItem();
    const label = item.label;
    invariant(label != null);
    menu.addItemToShowInSection(item, 100);
    await waitsFor(() => fileTreeItems().some(x => x.label === label));
    const groups = itemGroups(fileTreeItems());
    expect(getNonNull(groups, label)).toBe(
      getNonNull(groups, 'Copy Full Path'),
    );
  });
});

function testItem(): FileTreeContextMenuItem {
  return {
    label: 'Test Label',
    command: 'command-for-test',
    shouldDisplay() {
      return true;
    },
  };
}

function fileTreeItems(): Array<atom$ContextMenuItem> {
  const items = fileTreeItemsOrNull();
  invariant(items != null);
  return items;
}

function fileTreeItemsOrNull(): ?Array<atom$ContextMenuItem> {
  const itemSets = atom.contextMenu.itemSets.filter(
    x => x.selector === EVENT_HANDLER_SELECTOR,
  );
  invariant(itemSets.length <= 1);
  return itemSets.length === 0 ? null : itemSets[0].items;
}

function itemGroups(
  items: Array<atom$ContextMenuItem>,
): Map<string, Array<atom$ContextMenuItem>> {
  const map = new Map();
  let array = [];
  for (const item of items) {
    if (item.type === 'separator') {
      array = [];
    } else if (typeof item.label === 'string') {
      map.set(item.label, array);
      array.push(item);
    }
  }
  return map;
}

function getNonNull<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  invariant(value != null, `Key not found: '${String(key)}'`);
  return value;
}
