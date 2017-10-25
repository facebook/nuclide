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

import type {AutocompleteResult} from '../lib/LanguageService';

import {Range} from 'atom';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {jasmineAttachWorkspace} from 'nuclide-commons-atom/test-helpers';
import {AutocompleteProvider} from '../lib/AutocompleteProvider';
import {ConnectionCache} from '../../nuclide-remote-connection';

describe('AutocompleteProvider', () => {
  let editor: atom$TextEditor;
  let disposables: UniversalDisposable;
  const onDidInsertSuggestionSpy = jasmine.createSpy('onDidInsertSuggestion');

  beforeEach(() => {
    jasmineAttachWorkspace();
    jasmine.useRealClock();

    const mockCache = new ConnectionCache(connection => {
      return ({
        getAutocompleteSuggestions(): Promise<?AutocompleteResult> {
          return Promise.resolve({
            isIncomplete: false,
            items: [
              {
                displayText: 'editSuggestion',
                textEdits: [
                  {
                    oldRange: new Range([0, 0], [0, 9]),
                    newText: 'replaced line',
                  },
                  {
                    oldRange: new Range([1, 0], [2, 0]),
                    newText: '',
                  },
                ],
                // should be ignored
                text: 'blah',
                snippet: 'blah',
              },
              {
                displayText: 'editSuggestion2',
                textEdits: [],
                // should be ignored
                text: 'blah',
                snippet: 'blah',
              },
            ],
          });
        },
      }: any);
    });

    disposables = new UniversalDisposable(
      AutocompleteProvider.register(
        'test',
        ['text.plain.null-grammar'],
        {
          inclusionPriority: 99,
          suggestionPriority: 99,
          disableForSelector: null,
          excludeLowerPriority: true,
          version: '2.0.0',
          analyticsEventName: 'test',
          onDidInsertSuggestionAnalyticsEventName: 'test',
          autocompleteCacherConfig: null,
        },
        onDidInsertSuggestionSpy,
        mockCache,
      ),
    );

    waitsForPromise({timeout: 10000}, async () => {
      editor = await atom.workspace.open('test.txt');
      await atom.packages.activatePackage('autocomplete-plus');
    });
  });

  afterEach(() => {
    disposables.dispose();
  });

  it('works with text edits', () => {
    // Insert some text...
    runs(() => {
      editor.setText('testtest\nsecond line\nthird line\n');
      // Create two cursors to test multi-cursor behavior.
      editor.setCursorBufferPosition([0, 4]);
      editor.addCursorAtBufferPosition([2, 3]);
      editor.insertText('_');
    });

    let suggestionList;
    waitsFor('autocomplete suggestions to appear', () => {
      const view = atom.views.getView(atom.workspace);
      const autocompleteView = view.querySelector('.autocomplete-plus');
      if (autocompleteView == null) {
        return false;
      }
      suggestionList = autocompleteView.querySelectorAll('li');
      return suggestionList.length > 0;
    });

    runs(() => {
      expect(suggestionList[0].innerText).toMatch(/^editSuggestion\s+/);
      expect(suggestionList[1].innerText).toMatch(/^editSuggestion2\s+/);

      // Confirm the autocomplete suggestion.
      atom.commands.dispatch(
        atom.views.getView(editor),
        'autocomplete-plus:confirm',
      );
      expect(onDidInsertSuggestionSpy).toHaveBeenCalled();
      expect(editor.getText()).toBe('replaced line\nthi_rd line\n');
      expect(
        editor.getCursorBufferPositions().map(point => point.toArray()),
      ).toEqual([
        [0, 13], // First cursor goes to the end of the first line.
        [1, 4], // Second cursor just moves up one line.
      ]);
    });

    // Make sure that the edits were atomic.
    runs(() => {
      atom.commands.dispatch(atom.views.getView(editor), 'core:undo');
      expect(editor.getText()).toBe('test_test\nsecond line\nthi_rd line\n');
    });
  });
});
