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

import busySignal from './utils/busy-signal-common';
import {describeRemotableTest} from './utils/remotable-tests';
import {
  getAutocompleteView,
  getAutocompleteSuggestions,
  getAutocompleteDescription,
  waitsForAutocompleteSuggestions,
} from './utils/autocomplete-common';
import {generateFlowProject} from './utils/flow-common';

describeRemotableTest('Flow Autocomplete', context => {
  it('tests simple autocomplete example', () => {
    let textEditor: atom$TextEditor = (null: any);
    let textEditorView: HTMLElement = (null: any);

    waitsForPromise({timeout: 240000}, async () => {
      const flowProjectPath = await generateFlowProject();

      // Add this directory as an atom project.
      await context.setProject(flowProjectPath);
      // Open a file in the flow project we copied, and get reference to the editor's HTML.
      textEditor = await atom.workspace.open(
        context.getProjectRelativePath('main.js'),
      );
    });

    waitsFor('spinner to start', 10000, () => {
      return busySignal.isBusy();
    });

    waitsFor('spinner to stop', 30000, () => {
      return !busySignal.isBusy();
    });

    runs(() => {
      textEditorView = atom.views.getView(textEditor);
      // Simulate a keypress to trigger the autocomplete menu.
      textEditor.moveToBottom();
      textEditor.insertText('\n');
      textEditor.insertText('n');
    });

    waitsForAutocompleteSuggestions();

    runs(() => {
      const items = getAutocompleteSuggestions();
      expect(items[0]).toEqual({
        word: 'num',
        leftLabel: '',
        rightLabel: 'number',
      });
      expect(getAutocompleteDescription()).toBe('number');

      // Confirm autocomplete.
      atom.commands.dispatch(textEditorView, 'autocomplete-plus:confirm');
      expect(getAutocompleteView()).not.toExist();
      const lineText = textEditor.lineTextForBufferRow(
        textEditor.getCursorBufferPosition().row,
      );
      expect(lineText).toBe('num');
    });
  });
});
