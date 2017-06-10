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

import invariant from 'assert';

describe('clicking on a tab', () => {
  let editor;
  let filePath = '';
  let workspaceElement;
  let styleElement;

  beforeEach(() => {
    filePath = require.resolve('./fixtures/atom-script-echo-in-commonjs');
    waitsForPromise(() => atom.packages.activatePackage('tabs'));
    waitsForPromise(async () => {
      editor = await atom.workspace.open(filePath);
    });

    // Add the workspace to the document and disable pointer events on the things that cover it.
    // This is necessary to use `document.elementFromPoint()`.
    // IMPORTANT: We make sure this is done after all of our async stuff so that tests running in
    // parallel won't be affected.
    runs(() => {
      // Use a style element (instead of manipulating the elements' styles directly) so that we
      // don't have to care when they're added to the document.
      styleElement = document.createElement('style');
      styleElement.innerHTML =
        '#jasmine-content, .spec-reporter-container { pointer-events: none }';
      workspaceElement = atom.views.getView(atom.workspace);
      const {body} = document;
      invariant(body != null);
      body.appendChild(styleElement);
      body.appendChild(workspaceElement);
    });
  });

  afterEach(() => {
    invariant(editor != null);
    editor.destroy();
    invariant(workspaceElement != null);
    workspaceElement.remove();
    invariant(styleElement != null);
    styleElement.remove();
    atom.packages.deactivatePackage('tabs');
  });

  // We target `[data-path]` in order to add content menu items to tabs and other locations. This
  // tests ensures that we know if it ever stops working (with the default theme).
  it("targets an element that's a descendant of a [data-path] element", () => {
    const tab = workspaceElement.querySelector(
      `.tab-bar [data-path="${filePath}"]`,
    );
    expect(tab).toBeTruthy();
    invariant(tab != null);
    const bounds = tab.getBoundingClientRect();
    let el = document.elementFromPoint(bounds.left, bounds.top);
    expect(ancestorHasPathAttribute(el)).toBe(true);
    el = document.elementFromPoint(
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
    );
    expect(ancestorHasPathAttribute(el)).toBe(true);
  });
});

function ancestorHasPathAttribute(element: HTMLElement): boolean {
  let el = element;
  while (el != null) {
    if ((el: any).dataset.path != null) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}
