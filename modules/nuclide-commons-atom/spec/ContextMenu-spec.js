/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import invariant from 'assert';

import ContextMenu from '../ContextMenu';

describe('ContextMenu', () => {
  const cssSelector = '.nuclide-context-menu-unit-test';
  let div: HTMLDivElement;
  let menu;

  beforeEach(() => {
    div = document.createElement('div');
    div.className = cssSelector.substring(1);
    atom.views.getView(atom.workspace).appendChild(div);
  });

  afterEach(() => {
    if (menu != null) {
      menu.dispose();
    }
    if (div != null) {
      invariant(div.parentNode != null);
      div.parentNode.removeChild(div);
    }
  });

  it('initializes an empty ContextMenu properly', () => {
    const options = {
      type: 'root',
      cssSelector,
    };
    menu = new ContextMenu(options);
    expect(menu.isEmpty()).toBe(true);
  });

  it('items added to a context menu appear in priority order', () => {
    waitsForPromise(async () => {
      const options = {
        type: 'root',
        cssSelector,
      };
      menu = new ContextMenu(options);

      menu.addItem({label: 'second'}, 20);
      menu.addItem({label: 'first', command: 'nuclide-do-something'}, 10);
      menu.addItem({label: 'fourth'}, 40);
      menu.addItem({label: 'third'}, 30);

      await waitForNextTick();

      expect(getTemplateForContextMenu()).toEqual([
        {label: 'first', command: 'nuclide-do-something'},
        {label: 'second'},
        {label: 'third'},
        {label: 'fourth'},
      ]);
    });
  });

  it('can handle a mix of menu and submenu items', () => {
    waitsForPromise(async () => {
      const options = {
        type: 'root',
        cssSelector,
      };
      menu = new ContextMenu(options);

      menu.addItem({label: 'two'}, 20);
      menu.addItem({label: 'one'}, 10);
      menu.addItem({label: 'four'}, 40);
      menu.addItem({label: 'three'}, 30);

      const submenu = new ContextMenu({
        type: 'submenu',
        label: 'sub',
        parent: menu,
      });
      menu.addSubmenu(submenu, 25);
      submenu.addItem({label: 'B'}, 2);
      submenu.addItem({label: 'A'}, 1);
      submenu.addItem({label: 'C'}, 3);

      await waitForNextTick();

      expect(getTemplateForContextMenu()).toEqual([
        {label: 'one'},
        {label: 'two'},
        {
          label: 'sub',
          submenu: [{label: 'A'}, {label: 'B'}, {label: 'C'}],
        },
        {label: 'three'},
        {label: 'four'},
      ]);
    });
  });

  it('dispose() returned for an item can be used to remove a menu item', () => {
    waitsForPromise(async () => {
      const options = {
        type: 'root',
        cssSelector,
      };
      menu = new ContextMenu(options);

      const disposableForItem = menu.addItem({label: 'two'}, 20);
      menu.addItem({label: 'one'}, 10);
      menu.addItem({label: 'four'}, 40);
      menu.addItem({label: 'three'}, 30);

      const submenu = new ContextMenu({
        type: 'submenu',
        label: 'sub',
        parent: menu,
      });
      const disposableForSubmenu = menu.addSubmenu(submenu, 25);
      submenu.addItem({label: 'B'}, 2);
      const disposableForSubmenuItem = submenu.addItem({label: 'A'}, 1);
      submenu.addItem({label: 'C'}, 3);

      await waitForNextTick();
      expect(getTemplateForContextMenu()).toEqual([
        {label: 'one'},
        {label: 'two'},
        {
          label: 'sub',
          submenu: [{label: 'A'}, {label: 'B'}, {label: 'C'}],
        },
        {label: 'three'},
        {label: 'four'},
      ]);

      // Note that unlike addItem() or addSubmenu(), invoking dispose() is synchronous.

      disposableForItem.dispose();
      expect(getTemplateForContextMenu()).toEqual([
        {label: 'one'},
        {
          label: 'sub',
          submenu: [{label: 'A'}, {label: 'B'}, {label: 'C'}],
        },
        {label: 'three'},
        {label: 'four'},
      ]);

      disposableForSubmenuItem.dispose();
      expect(getTemplateForContextMenu()).toEqual([
        {label: 'one'},
        {
          label: 'sub',
          submenu: [{label: 'B'}, {label: 'C'}],
        },
        {label: 'three'},
        {label: 'four'},
      ]);

      disposableForSubmenu.dispose();
      expect(getTemplateForContextMenu()).toEqual([
        {label: 'one'},
        {label: 'three'},
        {label: 'four'},
      ]);
    });
  });

  it('removing all submenu items should result in it being filtered from view', () => {
    waitsForPromise(async () => {
      const options = {
        type: 'root',
        cssSelector,
      };
      menu = new ContextMenu(options);

      menu.addItem({label: 'two'}, 20);
      menu.addItem({label: 'one'}, 10);
      menu.addItem({label: 'four'}, 40);
      menu.addItem({label: 'three'}, 30);

      const submenu = new ContextMenu({
        type: 'submenu',
        label: 'sub',
        parent: menu,
      });
      menu.addSubmenu(submenu, 25);
      const disposableForSubmenuItem1 = submenu.addItem({label: 'A'}, 1);
      const disposableForSubmenuItem2 = submenu.addItem({label: 'B'}, 2);
      const disposableForSubmenuItem3 = submenu.addItem({label: 'C'}, 3);

      await waitForNextTick();

      expect(getTemplateForContextMenu()).toEqual([
        {label: 'one'},
        {label: 'two'},
        {
          label: 'sub',
          submenu: [{label: 'A'}, {label: 'B'}, {label: 'C'}],
        },
        {label: 'three'},
        {label: 'four'},
      ]);

      disposableForSubmenuItem1.dispose();
      disposableForSubmenuItem2.dispose();
      disposableForSubmenuItem3.dispose();
      expect(getTemplateForContextMenu()).toEqual([
        {label: 'one'},
        {label: 'two'},
        {label: 'three'},
        {label: 'four'},
      ]);

      // It should still be possible to add items to the submenu after it has been cleared out.
      submenu.addItem({label: 'D'}, 4);

      await waitForNextTick();

      expect(getTemplateForContextMenu()).toEqual([
        {label: 'one'},
        {label: 'two'},
        {
          label: 'sub',
          submenu: [{label: 'D'}],
        },
        {label: 'three'},
        {label: 'four'},
      ]);
    });
  });

  it('.isEmpty()', () => {
    const options = {
      type: 'root',
      cssSelector,
    };
    menu = new ContextMenu(options);
    expect(menu.isEmpty()).toBe(true);

    const submenu = new ContextMenu({
      type: 'submenu',
      label: 'sub',
      parent: menu,
    });
    const disposableForSubmenu = menu.addSubmenu(submenu, 20);
    expect(menu.isEmpty()).toBe(false);

    disposableForSubmenu.dispose();
    expect(menu.isEmpty()).toBe(true);
  });

  it('.dispose() removes all items', () => {
    waitsForPromise(async () => {
      const options = {
        type: 'root',
        cssSelector,
      };
      menu = new ContextMenu(options);

      menu.addItem({label: 'two'}, 20);
      menu.addItem({label: 'one'}, 10);
      menu.addItem({label: 'four'}, 40);
      menu.addItem({label: 'three'}, 30);

      const submenu = new ContextMenu({
        type: 'submenu',
        label: 'sub',
        parent: menu,
      });
      menu.addSubmenu(submenu, 25);
      submenu.addItem({label: 'B'}, 2);
      submenu.addItem({label: 'A'}, 1);
      submenu.addItem({label: 'C'}, 3);

      await waitForNextTick();

      expect(getTemplateForContextMenu()).toEqual([
        {label: 'one'},
        {label: 'two'},
        {
          label: 'sub',
          submenu: [{label: 'A'}, {label: 'B'}, {label: 'C'}],
        },
        {label: 'three'},
        {label: 'four'},
      ]);

      expect(menu.isEmpty()).toBe(false);
      menu.dispose();
      expect(menu.isEmpty()).toBe(true);
      expect(getTemplateForContextMenu()).toEqual([]);
    });
  });

  function getTemplateForContextMenu(): Array<atom$ContextMenuItem> {
    const template: Array<atom$ContextMenuItem> =
      // $FlowIgnore: This relies on an non-public API of Atom's ContextMenuManager.
      atom.contextMenu.templateForElement(div);
    const lastItem = template[template.length - 1];
    // Unfortunately, Atom does not give us a way to exclude the 'Inspect Element' item from
    // a custom context menu. For now, we exclude it from the template to reduce noise in our
    // unit tests.
    if (lastItem.label === 'Inspect Element') {
      template.pop();
    }
    return template;
  }
});

/**
 * Calls to ContextMenu.addItem() and ContextMenu.addSubmenu() on the same turn of the event loop
 * batch up their internal _sort() calls to run at the end of the current event loop. This function
 * facilitates waiting for that to happen.
 *
 * @return Promise that resolves on process.nextTick().
 */
function waitForNextTick(): Promise<void> {
  return new Promise(resolve => process.nextTick(resolve));
}
