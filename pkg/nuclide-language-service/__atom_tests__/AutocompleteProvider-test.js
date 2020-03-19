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
import type {AutocompleteResult, Completion} from '../lib/LanguageService';

import invariant from 'assert';
import {Point, Range} from 'atom';
import {nextTick} from 'nuclide-commons/promise';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {attachWorkspace} from 'nuclide-commons-atom/test-helpers';
import {updateAutocompleteResults, updateAutocompleteFirstResults} from '..';
import AutocompleteCacher from '../../commons-atom/AutocompleteCacher';
import {
  AutocompleteProvider,
  updateAutocompleteResultRanges,
} from '../lib/AutocompleteProvider';
import {ConnectionCache} from '../../nuclide-remote-connection';
import path from 'path'; // eslint-disable-line nuclide-internal/prefer-nuclide-uri
import waitsFor from '../../../jest/waits_for';

describe.skip('AutocompleteProvider', () => {
  let editor: atom$TextEditor;
  let disposables: UniversalDisposable;
  let onDidInsertSuggestionSpy;

  async function runAutocompleteTest(
    suggestions: Array<Completion>,
    resolver: Completion => ?Completion,
    startingText: string,
    mainCursorPos: atom$PointLike,
    secondaryCursorPos: Array<atom$PointLike>,
    expectedText: string,
    expectedEndingCursorPos: Array<atom$PointLike>,
  ) {
    onDidInsertSuggestionSpy = jest.fn();

    const mockCache = new ConnectionCache(connection => {
      return ({
        getAutocompleteSuggestions(): Promise<?AutocompleteResult> {
          return Promise.resolve({
            isIncomplete: false,
            items: suggestions,
          });
        },
        resolveAutocompleteSuggestion(
          completion: Completion,
        ): Promise<?Completion> {
          const result = resolver(completion);
          if (result == null) {
            return Promise.resolve(result);
          }

          // Delete the provider to simulate this being an RPC call (since we
          // can't move that across RPC), and text edits aren't applied if there
          // isn't a provider (autocomplete-plus internals, but it's bitten us).
          delete (result: any).provider;
          return Promise.resolve(result);
        },
      }: any);
    });

    disposables.add(
      AutocompleteProvider.register(
        'test',
        ['text.plain.null-grammar'],
        {
          inclusionPriority: 99,
          suggestionPriority: 99,
          disableForSelector: null,
          excludeLowerPriority: true,
          analytics: {
            eventName: 'test',
            shouldLogInsertedSuggestion: false,
          },
          autocompleteCacherConfig: null,
          supportsResolve: true,
        },
        onDidInsertSuggestionSpy,
        mockCache,
      ),
    );

    editor = await atom.workspace.open('test.txt');
    await atom.packages.activatePackage('autocomplete-plus');
    atom.packages.loadPackage(
      path.join(__dirname, '../../nuclide-autocomplete'),
    );
    await atom.packages.activatePackage('nuclide-autocomplete');

    // Insert some text...
    editor.setText(startingText);
    editor.setCursorBufferPosition(mainCursorPos);
    for (const secondaryCursor of secondaryCursorPos) {
      editor.addCursorAtBufferPosition(secondaryCursor);
    }
    editor.insertText('_');
    const expectedUndoText = editor.getText();
    await nextTick();
    atom.commands.dispatch(
      atom.views.getView(editor),
      'autocomplete-plus:activate',
      {activatedManually: false},
    );

    let suggestionList;
    await waitsFor(() => {
      const view = atom.views.getView(atom.workspace);
      const autocompleteView = view.querySelector('.autocomplete-plus');
      if (autocompleteView == null) {
        return false;
      }
      suggestionList = autocompleteView.querySelectorAll('li');
      return suggestionList.length > 0;
    });

    // $FlowFixMe
    expect(suggestionList.length).toEqual(suggestions.length);
    // $FlowFixMe
    for (let i = 0; i < suggestionList.length; i++) {
      const displayText = suggestions[i].displayText;
      invariant(displayText != null);
      // $FlowFixMe
      expect(suggestionList[i].innerText).toMatch(new RegExp(displayText));
    }

    // Confirm the autocomplete suggestion.
    atom.commands.dispatch(
      atom.views.getView(editor),
      'autocomplete-plus:confirm',
    );
    expect(onDidInsertSuggestionSpy).toHaveBeenCalled();
    expect(editor.getText()).toBe(expectedText);
    expect(
      editor.getCursorBufferPositions().map(point => point.toArray()),
    ).toEqual(expectedEndingCursorPos);

    // Make sure that the edits were atomic.
    atom.commands.dispatch(atom.views.getView(editor), 'core:undo');
    expect(editor.getText()).toBe(expectedUndoText);
  }

  beforeEach(() => {
    attachWorkspace();
    disposables = new UniversalDisposable();
  });

  afterEach(() => {
    disposables.dispose();
    if (editor) {
      editor.destroy();
      editor = (null: any);
    }
  });

  it('works with text edits', async () => {
    let calledResolve = false;
    const suggestion1 = {
      displayText: 'editSuggestion',
      textEdits: [
        {
          oldRange: new Range([0, 0], [0, 9]),
          newText: 'test range updating',
        },
      ],
      // should be ignored
      text: 'blah',
      snippet: 'blah',

      // Add extra data to the completion to make sure that it gets returned as
      // well, rather than Atom making a fresh copy.
      notInSpec: 'blah',
    };
    const suggestion2 = {
      displayText: 'editSuggestion2',
      textEdits: [],
      // should be ignored
      text: 'blah',
      snippet: 'blah',
    };
    function resolver(completion: Completion): Completion {
      calledResolve = true;
      expect(completion).toBe(suggestion1);
      return {
        ...suggestion1,
        textEdits: [
          {
            oldRange: new Range([1, 0], [2, 0]),
            newText: '',
          },
          {
            // This TextEdit is identical to the one above, except that its
            // range is shorter. This simulates some of our language
            // services that use autocomplete caching, but have to send the
            // original autocomplete (without the cache's range updating) to
            // the server in order to resolve it properly.
            oldRange: new Range([0, 0], [0, 4]),
            newText: 'test range updating',
          },
        ],
      };
    }
    await runAutocompleteTest(
      [suggestion1, suggestion2],
      resolver,
      'testtest\nsecond line\nthird line\n',
      [0, 4],
      [[2, 3]],
      'test range updating\nthi_rd line\n',
      [[0, 19], [1, 4]],
    );
    runs(() => {
      expect(calledResolve).toBeTruthy();
    });
  });

  it('will duplicate text edits if there is one text edit and multiple cursors', async () => {
    const suggestion = {
      displayText: 'editSuggestion',
      textEdits: [
        {
          oldRange: new Range([0, 6], [0, 11]),
          newText: 'test',
        },
      ],
    };
    const resolver = completion => null;
    await runAutocompleteTest(
      [suggestion],
      resolver,
      'first line\nsecond line\nthird line\nfourth line',
      [0, 10],
      [[1, 2], [2, 5], [3, 11]],
      'first test\nse_cond line\nttest line\nfourth test',
      [[0, 10], [1, 3], [2, 5], [3, 11]],
    );
  });

  it('will not apply text edits that would overlap after copying', async () => {
    const suggestion = {
      displayText: 'editSuggestion',
      textEdits: [
        {
          oldRange: new Range([0, 9], [0, 12]),
          newText: 'test',
        },
      ],
    };
    const resolver = completion => null;
    await runAutocompleteTest(
      [suggestion],
      resolver,
      'first line',
      [0, 10],
      [[0, 9]],
      'first lin_e_',
      [[0, 12], [0, 10]],
    );
  });
});

describe('updateAutocompleteResultRanges', () => {
  async function withEditor(callback: atom$TextEditor => Promise<void> | void) {
    const editor = await atom.workspace.open('test.txt');
    await callback(editor);
  }

  function makeRequest(
    point: atom$PointLike,
    editor: atom$TextEditor,
  ): atom$AutocompleteRequest {
    return {
      bufferPosition: Point.fromObject(point),
      editor,
      prefix: '',
      scopeDescriptor: ('': any),
    };
  }

  function makeResult(
    oldRangesList: Array<Array<atom$Range>>,
    sortText: ?string,
  ): AutocompleteResult {
    return {
      isIncomplete: false,
      items: oldRangesList.map(oldRanges => {
        if (oldRanges) {
          return {
            textEdits: oldRanges.map(oldRange => ({
              oldRange,
              newText: '',
            })),
            sortText: sortText == null ? undefined : sortText,
          };
        } else {
          return {
            insertText: '',
          };
        }
      }),
    };
  }

  it('updates ranges that match', async () =>
    withEditor(editor => {
      expect(
        updateAutocompleteResultRanges(
          makeRequest([0, 3], editor),
          makeRequest([0, 5], editor),
          makeResult([[Range.fromObject([[0, 0], [0, 3]])]]),
        ),
      ).toEqual(makeResult([[Range.fromObject([[0, 0], [0, 5]])]]));
    }));

  it("ignores ranges that don't", async () =>
    withEditor(editor => {
      expect(
        updateAutocompleteResultRanges(
          makeRequest([0, 3], editor),
          makeRequest([0, 5], editor),
          makeResult([[Range.fromObject([[0, 0], [0, 4]])]]),
        ),
      ).toEqual(makeResult([[Range.fromObject([[0, 0], [0, 4]])]]));
    }));

  it('can handle some elements without text edits', async () =>
    withEditor(editor => {
      expect(
        updateAutocompleteResultRanges(
          makeRequest([0, 3], editor),
          makeRequest([0, 5], editor),
          makeResult([[Range.fromObject([[0, 0], [0, 3]])], []]),
        ),
      ).toEqual(makeResult([[Range.fromObject([[0, 0], [0, 5]])], []]));
    }));

  it('can handle elements with multiple text edits', async () =>
    withEditor(editor => {
      expect(
        updateAutocompleteResultRanges(
          makeRequest([0, 3], editor),
          makeRequest([0, 5], editor),
          makeResult([
            [
              Range.fromObject([[0, 0], [0, 3]]),
              Range.fromObject([[0, 0], [0, 4]]),
              Range.fromObject([[0, 2], [0, 3]]),
            ],
          ]),
        ),
      ).toEqual(
        makeResult([
          [
            Range.fromObject([[0, 0], [0, 5]]),
            Range.fromObject([[0, 0], [0, 4]]),
            Range.fromObject([[0, 2], [0, 5]]),
          ],
        ]),
      );
    }));

  it('works with interleaved requests when caching is enabled', async () =>
    withEditor(async editor => {
      function makeResponsePromise(
        range: ?atom$Range,
      ): {promise: Promise<?AutocompleteResult>, resolve: () => void} {
        let resolvePromise;
        const promise = new Promise(resolve => {
          resolvePromise = resolve;
        });
        return {
          promise,
          resolve: () =>
            range == null
              ? resolvePromise(null)
              : resolvePromise(makeResult([[range]])),
        };
      }

      const request1 = makeRequest([0, 1], editor);
      const request2 = makeRequest([0, 2], editor);
      const request3 = makeRequest([0, 3], editor);
      const request4 = makeRequest([0, 4], editor);
      let resultValue: Promise<?AutocompleteResult> = (null: any);
      const getSuggestions = jest.fn().mockImplementation(() => resultValue);

      const autocompleteCacher = new AutocompleteCacher(getSuggestions, {
        updateResults: updateAutocompleteResults,
        updateFirstResults: updateAutocompleteFirstResults,
        shouldFilter: () => true,
      });

      // Return null from the first request to make sure that we're properly
      // attaching requests to results.
      const response1Promise = makeResponsePromise(null);
      resultValue = response1Promise.promise;
      autocompleteCacher.getSuggestions(request1);

      const response2Promise = makeResponsePromise(
        Range.fromObject([[0, 0], [0, 2]]),
      );
      resultValue = response2Promise.promise;
      autocompleteCacher.getSuggestions(request2);
      expect(getSuggestions.mock.calls.length).toBe(2);

      // To hit this behavior we need to make at least two interleaved requests
      // after the most recent request that returned null (or just at least two
      // requests if none of them return null).
      const response3Promise = makeResponsePromise(
        Range.fromObject([[0, 0], [0, 3]]),
      );
      resultValue = response3Promise.promise;
      autocompleteCacher.getSuggestions(request3);
      expect(getSuggestions.mock.calls.length).toBe(3);

      response1Promise.resolve();
      response2Promise.resolve();
      response3Promise.resolve();

      resultValue = new Promise((resolve, reject) => {
        reject(new Error('The third result should come from the cache.'));
      });
      const resultsFromUpdatedCache = await autocompleteCacher.getSuggestions(
        request4,
      );

      expect(resultsFromUpdatedCache).toEqual(
        makeResult([[Range.fromObject([[0, 0], [0, 4]])]], ''),
      );
    }));
});
