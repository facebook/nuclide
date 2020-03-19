/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

export function sortLabelValue(label: ?string) {
  // Ignore the Windows accelerator key hint when sorting, the & doesn't
  // actually appear in the UX so it shouldn't affect the sort.
  return String(label).replace('&', '');
}

export function sortSubmenuGroup(
  menuItems: Array<{
    label: string,
  }>,
  startIndex: number,
  itemCount: number,
) {
  // Sort a subset of the items in the menu of length itemCount beginning
  // at startIndex.
  const itemsToSort = menuItems.splice(startIndex, itemCount);
  itemsToSort.sort((a, b) => {
    // Always put the "Version" label up top.
    if (sortLabelValue(a.label).startsWith('Version')) {
      return -1;
    } else {
      return sortLabelValue(a.label).localeCompare(sortLabelValue(b.label));
    }
  });

  menuItems.splice(startIndex, 0, ...itemsToSort);
}

export function sortMenuGroups(menuNames: Array<string>) {
  for (const menuName of menuNames) {
    // Sorts the items in a menu alphabetically. If the menu contains one or more
    // separators, then the items within each separator subgroup will be sorted
    // with respect to each other, but items will remain in the same groups, and
    // the separators will not be moved.
    const menu = atom.menu.template.find(
      m => sortLabelValue(m.label) === menuName,
    );
    if (menu == null) {
      continue;
    }

    // Sort each group of items (separated by a separator) individually.
    let sortStart = 0;
    for (let i = 0; i < menu.submenu.length; i++) {
      if (menu.submenu[i].type === 'separator') {
        sortSubmenuGroup(menu.submenu, sortStart, i - sortStart);
        sortStart = i + 1;
      }
    }

    // Sort any remaining items after the last separator.
    if (sortStart < menu.submenu.length) {
      sortSubmenuGroup(
        menu.submenu,
        sortStart,
        menu.submenu.length - sortStart,
      );
    }
  }

  atom.menu.update();
}
