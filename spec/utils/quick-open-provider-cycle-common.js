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

import type {TestContext} from './remotable-tests';

import invariant from 'assert';

import {dispatchKeyboardEvent} from '../../pkg/commons-atom/testHelpers';
import {copyFixture} from '../../pkg/nuclide-test-helpers';

function sleep(milliSeconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliSeconds);
  });
}

export function runTest(context: TestContext) {
  function providerTextExistsInDOM(element: Element, text: string): boolean {
    const providerElems = element.querySelectorAll('span.icon-gear');
    const providerElemWithText = Array.prototype.find.call(
      providerElems,
      providerSpanElem => providerSpanElem.innerHTML === text,
    );
    return providerElemWithText != null;
  }

  function closestAncestorWithClassName(
    element: Element,
    className: string,
  ): Element {
    if (element.className === className) {
      return element;
    }
    const parent = element.parentElement;
    invariant(parent != null);
    return closestAncestorWithClassName(parent, className);
  }

  it('cycles through files from all providers when key is held', () => {
    // Time taken to run test scales linearly as NUM_FILES_TO_OPEN increases.
    // Increase at your own risk!
    const NUM_FILES_TO_OPEN = 5;
    const PACKAGE_NAME = 'nuclide-quick-open';

    let omniSearchModal: ?HTMLElement = (null: any);
    let firstActiveElement: ?HTMLElement = (null: any);
    let repoPath: string;

    // Test setup
    waitsForPromise(async () => {
      repoPath = await copyFixture('cpp_project', __dirname);
      await context.setProject(repoPath);
    });

    // Open and create (save) files.
    for (let i = 0; i < NUM_FILES_TO_OPEN; i++) {
      waitsForPromise(async () => {
        const editor = await atom.workspace.open(
          context.getProjectRelativePath(`TEST${i}.txt`),
        );
        invariant(editor != null);
        await editor.save();
      });
    }

    // Open the quick-open panel
    runs(() => {
      const quickOpenPackage = atom.packages.getActivePackage(PACKAGE_NAME);
      invariant(
        quickOpenPackage,
        `The "${PACKAGE_NAME}" package is not active!`,
      );
      invariant(document.activeElement != null);
      atom.commands.dispatch(
        document.activeElement,
        'nuclide-quick-open:find-anything-via-omni-search',
      );
    });

    waitsFor('quick-open panel to open', () => {
      omniSearchModal = document.querySelector('.omnisearch-modal');
      return omniSearchModal != null;
    });

    waitsFor('quick-open providers to load', () => {
      const omniSearchTreeList = document.querySelector(
        '.omnisearch-pane .list-tree',
      );
      invariant(omniSearchTreeList != null);
      const omniSearchTreeNodes = omniSearchTreeList.querySelectorAll(
        '.list-nested-item',
      );
      return omniSearchTreeNodes.length > 0;
    });

    waitsFor('first result item is selected', () => {
      firstActiveElement = document.querySelector(
        '.quick-open-result-item.list-item.selected:first-child',
      );
      return firstActiveElement != null;
    });

    // Expect that 'down arrow' selects the next item
    runs(() => {
      dispatchKeyboardEvent('down', document.activeElement);
      const nextActiveElement = document.querySelector(
        '.quick-open-result-item.list-item.selected',
      );
      expect(nextActiveElement).not.toBeNull();
      invariant(firstActiveElement != null);
      expect(nextActiveElement).toBe(firstActiveElement.nextElementSibling);
    });

    waitsFor('active quick-open item to scroll back to first element', () => {
      // Dispatch 'down arrow' key event to quick open modal
      dispatchKeyboardEvent('down', document.activeElement);
      const newActiveElement = document.querySelector(
        '.quick-open-result-item.list-item.selected',
      );
      return newActiveElement === firstActiveElement;
    });

    // Close the quick-open modal, making a TextEditor the active pane
    runs(() => {
      dispatchKeyboardEvent('escape', document.activeElement, {cmd: false});
    });

    // Close half of the opened files in order to populate "Recent Files"
    for (let i = 0; i < NUM_FILES_TO_OPEN / 2; i++) {
      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        invariant(editor != null);
        editor.destroy();
      });
      // Wait for closed file to propagate to "Recent Files" service
      waitsForPromise(async () => {
        await sleep(100);
      });
    }

    runs(() => {
      const editor = atom.workspace.getActiveTextEditor();
      invariant(editor != null);
      atom.commands.dispatch(
        atom.views.getView(editor),
        'nuclide-quick-open:find-anything-via-omni-search',
      );
    });

    waitsFor('open file provider to load', () => {
      const omniSearchTreeList = document.querySelector(
        '.omnisearch-pane .list-tree',
      );
      invariant(omniSearchTreeList != null);
      return providerTextExistsInDOM(omniSearchTreeList, 'Open Files');
    });

    waitsFor('recent file provider to load', () => {
      const omniSearchTreeList = document.querySelector(
        '.omnisearch-pane .list-tree',
      );
      invariant(omniSearchTreeList != null);
      return providerTextExistsInDOM(omniSearchTreeList, 'Recent Files');
    });

    // Recent files requires a non-empty search query
    runs(() => {
      const omniSearchTextEditorQueryString =
        'atom-workspace atom-panel-container.modal' +
        ' atom-panel atom-text-editor.mini';
      const omniSearchTextEditorElement = document.querySelector(
        omniSearchTextEditorQueryString,
      );
      invariant(omniSearchTextEditorElement != null);
      // make active element
      omniSearchTextEditorElement.click();
      // upcast to `any` before downcasting to child type
      const omniSearchTextEditor = ((omniSearchTextEditorElement: any): atom$TextEditorElement).getModel();
      omniSearchTextEditor.insertText('TEST');
    });

    waitsFor('filenames provider to load', () => {
      const omniSearchTreeList = document.querySelector(
        '.omnisearch-pane .list-tree',
      );
      invariant(omniSearchTreeList != null);
      return providerTextExistsInDOM(omniSearchTreeList, 'Filenames');
    });

    // Ensure that the you can scroll to at least one item from each provider
    const providerTitles = new Set(['Open Files', 'Recent Files', 'Filenames']);
    providerTitles.forEach(title => {
      waitsFor(
        `active item to scroll to a file supplied by the "${title}" provider"`,
        () => {
          // Dispatch 'down arrow' key event to quick open modal
          dispatchKeyboardEvent('down', document.activeElement);
          const newActiveElement = document.querySelector(
            '.quick-open-result-item.list-item.selected',
          );
          if (newActiveElement == null) {
            return false;
          }
          const providerElement = closestAncestorWithClassName(
            newActiveElement,
            'list-nested-item',
          );
          return (
            providerElement != null &&
            providerTextExistsInDOM(providerElement, title)
          );
        },
      );
    });
  });
}
