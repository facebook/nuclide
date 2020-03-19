/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
describe('main', () => {
  // TODO: Loading packages is rightfully slow; it `require`s a lot of files. Possible to inject
  // the `activation` class or move it to its own package to mock `require` it?
  it.skip("disables Atom's builtin tree-view package on activation", async () => {
    expect(atom.packages.isPackageDisabled('tree-view')).toBe(false);
    await atom.packages.activatePackage('nuclide-file-tree');
    expect(atom.packages.isPackageDisabled('tree-view')).toBe(true);
  });

  // Closing an Atom window calls `deactivate` on loaded packages.
  it.skip("re-enables Atom's builtin tree-view package on disable", async () => {
    expect(atom.packages.isPackageDisabled('tree-view')).toBe(false);
    await atom.packages.activatePackage('nuclide-file-tree');
    // atom.packages.disablePackage('nuclide-file-tree');
    // atom.packages.deactivatePackage('nuclide-file-tree');
    // expect(atom.packages.isPackageDisabled('tree-view')).toBe(false);
  });

  it('yells if atom breaks the fixContextMenuHighlight hack', () => {
    // If you see this error fail, this means that something inside of Atom
    // changed and the context menu highlight hack may not be working anymore,
    // See https://github.com/atom/atom/pull/13266 for context.
    const showForEvent = (atom.contextMenu: any).showForEvent;
    expect(typeof showForEvent).toBe('function');
    expect(showForEvent.name).not.toMatch(/requestAnimationFrame/);
  });
});
