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

import busySignal from './utils/busy-signal-common';
import {describeRemotableTest} from './utils/remotable-tests';
import {
  getAutocompleteView,
  getAutocompleteSuggestions,
  getAutocompleteDescription,
  waitsForAutocompleteSuggestions,
} from './utils/autocomplete-common';
import {copyBuildFixture} from '../pkg/nuclide-test-helpers';
import {
  dispatchKeyboardEvent,
  waitsForFile,
  waitsForFilePosition,
} from '../pkg/commons-atom/testHelpers';

function getOutlineData(node) {
  return {
    name: node.innerText,
    classes: node.className.split(' ').sort(),
  };
}

/**
 * This is a full integration test for (local) Objective-C support in Nuclide.
 * After loading a test Buck project, this tests:
 *
 * 1. autocompletion support
 * 2. diagnostics for errors
 * 3. outline view
 * 4. type datatips
 * 5. go-to-definition with Hyperclick
 */
describeRemotableTest('Clang Integration Test (C++)', context => {
  it('supports all language features', () => {
    let testDir: string;
    let textEditor: atom$TextEditor;
    let textEditorView: HTMLElement;
    waitsForPromise({timeout: 60000}, async () => {
      testDir = await copyBuildFixture('cpp_project', __dirname);
      await context.setProject(testDir);
      textEditor = await atom.workspace.open(
        context.getProjectRelativePath('test.cpp'),
      );
      textEditorView = atom.views.getView(textEditor);
    });

    waitsForFile('test.cpp');

    waitsFor('compilation to begin', 10000, () => {
      return busySignal.isBusy();
    });

    waitsFor('compilation to finish', 60000, () => {
      return !busySignal.isBusy();
    });

    runs(() => {
      // Trigger autocompletion.
      textEditor.setCursorBufferPosition([13, 0]);
      textEditor.insertText('t.');
      textEditor.insertText('m');
    });

    waitsForAutocompleteSuggestions();

    waitsForPromise(async () => {
      const items = getAutocompleteSuggestions();
      expect(items.length).toBeGreaterThan(1);
      expect(items[0]).toEqual({
        word: 'method()',
        leftLabel: 'void',
        rightLabel: 'CXXMethod',
      });
      expect(items[1]).toEqual({
        word: 'member',
        leftLabel: 'int',
        rightLabel: 'Field',
      });
      expect(getAutocompleteDescription()).toBe('Test documentation');

      // Confirm autocomplete.
      dispatchKeyboardEvent('enter', document.activeElement);
      expect(getAutocompleteView()).not.toExist();
      const lineText = textEditor.lineTextForBufferRow(
        textEditor.getCursorBufferPosition().row,
      );
      expect(lineText).toBe('t.method()}');

      // This is a clear syntax error, so we should get an error on save.
      await textEditor.save();
    });

    waitsFor('error to show up in diagnostics', 10000, () => {
      const errors = atom.views
        .getView(atom.workspace)
        .querySelector('.diagnostics-status-bar-highlight');
      if (errors instanceof HTMLElement) {
        const innerText = errors.innerText;
        invariant(innerText != null);
        return innerText.trim() === '1';
      }
    });

    runs(() => {
      // Keyboard shortcut for outline view.
      dispatchKeyboardEvent('o', document.activeElement, {alt: true});
    });

    let names;
    waitsFor('outline view to load', 10000, () => {
      names = atom.views
        .getView(atom.workspace)
        .querySelectorAll('.outline-view-item .syntax--name');
      return names.length > 0;
    });

    runs(() => {
      atom.views.getView(textEditor).focus();

      expect(names.length).toBe(4);
      expect(getOutlineData(names[0])).toEqual({
        name: 'TestClass<T>',
        classes: ['syntax--class', 'syntax--entity', 'syntax--name'],
      });
      expect(getOutlineData(names[1])).toEqual({
        name: 'member',
        classes: ['syntax--class', 'syntax--entity', 'syntax--name'],
      });
      expect(getOutlineData(names[2])).toEqual({
        name: 'method',
        classes: ['syntax--entity', 'syntax--function', 'syntax--name'],
      });
      expect(getOutlineData(names[3])).toEqual({
        name: 'main',
        classes: ['syntax--entity', 'syntax--function', 'syntax--name'],
      });

      // Trigger a datatip on t
      textEditor.setCursorBufferPosition([12, 17]);
      atom.commands.dispatch(textEditorView, 'datatip:toggle');
    });

    let datatip;
    waitsFor('datatip to appear for TestClass', () => {
      datatip = atom.views
        .getView(atom.workspace)
        .querySelector('.datatip-content atom-text-editor');
      return datatip;
    });

    runs(() => {
      // $FlowFixMe
      expect(datatip.getModel().getText()).toBe('TestClass<int>');

      // Hyperclick on TestClass
      textEditor.setCursorBufferPosition([12, 10]);
      // hyperclick:confirm-cursor
      dispatchKeyboardEvent('enter', document.activeElement, {
        cmd: true,
        alt: true,
      });
    });

    waitsForFilePosition('test.cpp', 3, 6);
  });
});
