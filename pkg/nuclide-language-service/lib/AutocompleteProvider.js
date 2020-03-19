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

import type {AutocompleteCacherConfig} from '../../commons-atom/AutocompleteCacher';

import type {
  AutocompleteResult,
  AutocompleteRequest,
  Completion,
  LanguageService,
} from './LanguageService';
import type {AutocompleteAnalytics} from '../../nuclide-autocomplete/lib/types';

import invariant from 'assert';
import fuzzaldrinPlus from 'fuzzaldrin-plus';
import {Point, Range} from 'simple-text-buffer';
import {wordAtPosition} from 'nuclide-commons-atom/range';
import {ConnectionCache} from '../../nuclide-remote-connection';
import {getFileVersionOfEditor} from '../../nuclide-open-files';
import AutocompleteCacher from '../../commons-atom/AutocompleteCacher';
import {applyTextEditsToBuffer} from 'nuclide-commons-atom/text-edit';

export type OnDidInsertSuggestionArgument = {
  editor: atom$TextEditor,
  triggerPosition: atom$Point,
  suggestion: Completion,
};

export type OnDidInsertSuggestionCallback = (
  arg: OnDidInsertSuggestionArgument,
) => mixed;

export type AutocompleteConfig = {|
  inclusionPriority: number,
  suggestionPriority: number,
  disableForSelector: ?string,
  excludeLowerPriority: boolean,
  analytics: AutocompleteAnalytics,
  autocompleteCacherConfig: ?AutocompleteCacherConfig<AutocompleteResult>,
  supportsResolve: boolean,
|};

export class AutocompleteProvider<T: LanguageService> {
  name: string;
  selector: string;
  inclusionPriority: number;
  suggestionPriority: number;
  disableForSelector: ?string;
  excludeLowerPriority: boolean;
  analytics: AutocompleteAnalytics;
  onDidInsertSuggestion: OnDidInsertSuggestionCallback;
  _onDidInsertSuggestion: ?OnDidInsertSuggestionCallback;
  _connectionToLanguageService: ConnectionCache<T>;
  _autocompleteCacher: ?AutocompleteCacher<AutocompleteResult>;
  _supportsResolve: boolean;

  constructor(
    name: string,
    selector: string,
    inclusionPriority: number,
    suggestionPriority: number,
    disableForSelector: ?string,
    excludeLowerPriority: boolean,
    analytics: AutocompleteAnalytics,
    onDidInsertSuggestion: ?OnDidInsertSuggestionCallback,
    autocompleteCacherConfig: ?AutocompleteCacherConfig<AutocompleteResult>,
    connectionToLanguageService: ConnectionCache<T>,
    supportsResolve: boolean,
  ) {
    this.name = name;
    this.selector = selector;
    this.inclusionPriority = inclusionPriority;
    this.suggestionPriority = suggestionPriority;
    this.disableForSelector = disableForSelector;
    this.excludeLowerPriority = excludeLowerPriority;
    this._connectionToLanguageService = connectionToLanguageService;
    this._supportsResolve = supportsResolve;

    if (autocompleteCacherConfig != null) {
      this._autocompleteCacher = new AutocompleteCacher(
        request => this._getSuggestionsFromLanguageService(request),
        autocompleteCacherConfig,
      );
    }

    this._onDidInsertSuggestion = onDidInsertSuggestion;

    this.onDidInsertSuggestion = suggestionInsertedRequest => {
      maybeApplyTextEdits(suggestionInsertedRequest);
      if (this._onDidInsertSuggestion != null) {
        this._onDidInsertSuggestion(suggestionInsertedRequest);
      }
    };

    this.analytics = analytics;
  }

  static register(
    name: string,
    grammars: Array<string>,
    config: AutocompleteConfig,
    onDidInsertSuggestion: ?OnDidInsertSuggestionCallback,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'nuclide-autocomplete.provider',
      '0.0.0',
      new AutocompleteProvider(
        name,
        // tree-sitter grammars won't include the ".".
        grammars
          .map(grammar => (grammar.includes('.') ? '.' + grammar : grammar))
          .join(', '),
        config.inclusionPriority,
        config.suggestionPriority,
        config.disableForSelector,
        config.excludeLowerPriority,
        config.analytics,
        onDidInsertSuggestion,
        config.autocompleteCacherConfig,
        connectionToLanguageService,
        config.supportsResolve,
      ),
    );
  }

  async getSuggestions(
    request: atom$AutocompleteRequest,
  ): Promise<?Array<Completion>> {
    let result;
    if (this._autocompleteCacher != null) {
      result = await this._autocompleteCacher.getSuggestions(request);
    } else {
      result = await this._getSuggestionsFromLanguageService(request);
    }
    return result != null ? result.items : null;
  }

  async _getSuggestionsFromLanguageService(
    request: atom$AutocompleteRequest,
  ): Promise<?AutocompleteResult> {
    const {editor} = request;
    const editorPath = editor.getPath();
    const languageService = this._connectionToLanguageService.getForUri(
      editorPath,
    );
    const fileVersion = await getFileVersionOfEditor(editor);
    if (languageService == null || fileVersion == null) {
      return {isIncomplete: false, items: []};
    }

    const langSpecificPrefix = getLanguageSpecificPrefix(request);
    const results = await (await languageService).getAutocompleteSuggestions(
      fileVersion,
      getPosition(request),
      generateAutocompleteRequest(request, langSpecificPrefix),
    );
    if (results == null) {
      return null;
    }

    const uniqueIndex = Math.floor(Math.random() * 1000000000);

    results.items.forEach((c: Completion, index) => {
      // textEdits aren't part of autocomplete-plus - we handle it in
      // onDidInsertSuggestion above. We need to make this suggestion a no-op otherwise.
      // There's no perfect solution at the moment, but the two options are:
      // 1) Make text equal to the replacement prefix.
      // 2) Provide an empty replacementPrefix, text, and snippet.
      //
      // 1) has the major downside of polluting the undo stack with an extra change.
      // `autocomplete-plus` also has a default suffix-consuming feature where any text
      // after the replaced text that matches a suffix of `text` will be deleted!
      //
      // 2) has the downside of not showing match highlights in the autocomplete UI.
      // Between the two, we'll prefer accuracy at the cost of beauty.
      //
      // To get a better solution, `autocomplete-plus` needs a new API for custom suggestions.
      if (c.textEdits != null) {
        c.text = '';
        // Atom ignores suggestions with an empty text & snippet.
        // However, we can provide an empty snippet to trick it!
        // 1) This works even if snippets are disabled.
        // 2) Empty snippets don't appear in the undo stack.
        // 3) autocomplete-plus dedupes snippets, so use unique indexes.
        c.snippet = `$${uniqueIndex + index}`;
        // Don't try to replace anything.
        c.replacementPrefix = '';
      } else if (
        c.replacementPrefix == null &&
        langSpecificPrefix !== request.prefix
      ) {
        // Here's where we patch up the prefix in the results, if necessary
        c.replacementPrefix = langSpecificPrefix;
      }

      invariant(editorPath != null);
      c.remoteUri = editorPath;
    });

    return results;
  }

  async getSuggestionDetailsOnSelect(
    suggestion: Completion,
  ): Promise<?Completion> {
    if (!this._supportsResolve) {
      return null;
    }

    const languageService = this._connectionToLanguageService.getForUri(
      suggestion.remoteUri,
    );
    if (languageService == null) {
      return null;
    }

    const resolved = await (await languageService).resolveAutocompleteSuggestion(
      suggestion,
    );
    if (resolved != null) {
      // A few members of the suggestion aren't RPC-able (such as the provider),
      // so merge the objects together.
      const result = {...suggestion, ...resolved};

      // Some language services (such as LspLanguageService) store a separate
      // cached version of the original completion that we're resolving since
      // they'll need to send it back to the language server in its original
      // form, rather than after it's been converted into a form that Nuclide
      // understands (see the usage of the extraData field in convert.js).
      // This means that with some servers, the resolved completion will have
      // the original old ranges on its textEdits, rather than the ones that
      // have been updated by updateRanges in AutocompleteCacher. Because of
      // that, we need to go through and update the ranges if we detect that we
      // can.
      if (suggestion.textEdits != null && resolved.textEdits != null) {
        const suggestionTextEdits = suggestion.textEdits;
        const resolvedTextEdits = resolved.textEdits;
        const localTextEdits = new Map(
          suggestionTextEdits.map(textEdit => [textEdit.newText, textEdit]),
        );
        const remoteTextEdits = new Map(
          resolvedTextEdits.map(textEdit => [textEdit.newText, textEdit]),
        );
        localTextEdits.forEach((textEdit, idx) => {
          const remoteTextEdit = remoteTextEdits.get(idx);
          if (remoteTextEdit != null) {
            remoteTextEdit.oldRange = textEdit.oldRange;
          }
        });
      }

      return result;
    }

    return null;
  }
}

function maybeApplyTextEdits(
  insertedSuggestionArgument: OnDidInsertSuggestionArgument,
) {
  const {editor, suggestion} = insertedSuggestionArgument;
  const textEdits = suggestion.textEdits;
  if (textEdits != null) {
    const cursors = editor.getCursors();
    if (textEdits.length === 1 && cursors.length > 1) {
      // Special case: if we have a single TextEdit and multiple cursors,
      // duplicate the TextEdit for each cursor. This is to preserve the
      // existing multi-autocomplete functionality that we had in insertText
      // completions.
      const textEdit = textEdits[0];
      const matches = cursor =>
        cursor.getBufferPosition().isEqual(textEdit.oldRange.end);
      const shouldCopy = cursors.some(matches);

      if (shouldCopy) {
        const columnDelta =
          textEdit.oldRange.end.column - textEdit.oldRange.start.column;

        for (const cursor of cursors) {
          if (!matches(cursor) && cursor.getBufferColumn() - columnDelta >= 0) {
            const newOldEnd = cursor.getBufferPosition();
            const newOldStart = Point.fromObject([
              newOldEnd.row,
              newOldEnd.column - columnDelta,
            ]);
            const newOldRange = Range.fromObject([newOldStart, newOldEnd]);
            textEdits.push({...textEdit, oldRange: newOldRange});
          }
        }
      }
    }
    applyTextEditsToBuffer(editor.getBuffer(), textEdits);
  }
}

// 'prefix' has to do with what's replaced when the user accepts an
// autocomplete suggestion. It's based on the current word. For instance,
//  '$c|'      => suggestion '$compare'  => hopefully replace '$c'
//  'Vec\com|' => suggestion 'compare'   => hopefully replace 'com'
// The way autocomplete works is: the language service might say what prefix
// its suggestion will replace; and if it doesn't, then autocomplete will
// replace whatever prefix was part of the 'request' object.
//
// Atom has its own way of computing the current word (to support gestures
// like cursor-past-word). It bases this on 'editor.nonWordCharacters', by
// default roughly [a-zA-Z0-9_]. But language packages can and do override
// this -- e.g. PHP allows '$' in identifiers.
//
// Autocomplete doesn't use Atom's technique (I suspect because the html and
// css and xml packages never bothered overriding it). Instead autocomplete
// has its own regex, roughly the same but allowing '-' as well. It uses
// this to populate 'prefix'.
//
// Autocomplete's suggestion is wrong for languages like PHP which have
// their own regex, is right for languages like HTML which should but don't,
// and is wrong for languages like Java which don't provide their own
// regex and which don't allow hyphens.
//
// What we'll do is work around this mess right here as best we can:
// if the language-package provides its own regex which gives a different
// prefix from Autocomplete's, then we'll suggest that to the language
// service, and we'll patch the output of the language service to reflect
// this.
function getLanguageSpecificPrefix(request: atom$AutocompleteRequest): string {
  const {editor} = request;
  const position = getPosition(request);

  const defaultWordRules = editor.getNonWordCharacters();
  const langWordRules = editor.getNonWordCharacters(position);
  if (defaultWordRules !== langWordRules) {
    return findAtomWordPrefix(editor, position);
  }
  return request.prefix;
}

// In case of automatic requests, we'd like to know what character triggered
// the autocomplete request. That information isn't provided to us, so the
// best we can do is find the character to the left of the position.
function findTriggerCharacter(request: atom$AutocompleteRequest): ?string {
  if (request.activatedManually != null && request.activatedManually) {
    return null;
  }

  const position = getPosition(request);
  if (position.column === 0) {
    return '\n';
  }

  const range = new Range([position.row, position.column - 1], position);
  return request.editor.getTextInBufferRange(range);
}

// TODO(ljw): the following line uses the position of the cursor --
// shouldn't it be using request.bufferPosition instead?
function getPosition(request: atom$AutocompleteRequest): atom$Point {
  return request.editor.getLastCursor().getBufferPosition();
}

function generateAutocompleteRequest(
  request: atom$AutocompleteRequest,
  prefix: string,
): AutocompleteRequest {
  const {activatedManually} = request;
  return {
    activatedManually: activatedManually == null ? false : activatedManually,
    triggerCharacter: findTriggerCharacter(request),
    prefix,
  };
}

function findAtomWordPrefix(
  editor: atom$TextEditor,
  position: atom$Point,
): string {
  const positionOneCharBefore = new Point(
    position.row,
    Math.max(0, position.column - 1),
  );
  const match = wordAtPosition(editor, positionOneCharBefore, {
    includeNonWordCharacters: false,
  });
  if (match == null) {
    return '';
  }
  return editor.getTextInBufferRange(new Range(match.range.start, position));
}

function padEnd(s: string, targetLength: number, padString: string): string {
  const padLength = Math.max(targetLength - s.length, 0);
  return s + padString.repeat(padLength);
}

export function updateAutocompleteResults(
  originalRequest: atom$AutocompleteRequest,
  currentRequest: atom$AutocompleteRequest,
  firstResult: AutocompleteResult,
): ?AutocompleteResult {
  if (firstResult.isIncomplete) {
    return null;
  }

  const results = updateAutocompleteFirstResults(currentRequest, firstResult);
  return updateAutocompleteResultRanges(
    originalRequest,
    currentRequest,
    results,
  );
}

export function updateAutocompleteFirstResults(
  request: atom$AutocompleteRequest,
  firstResult: AutocompleteResult,
): AutocompleteResult {
  // This function is sometimes called because the user invoked autocomplete
  // manually, e.g. pressing ctrl+space at "x.|" or "x.f|". Or it's invoked
  // from updateAutocompleteResults because there was it had previously
  // been invoked, and then the user typed more characters. In both cases
  // the behavior is the same...

  // Our objective is to provide a filtered list of results which [1] are
  // filtered to only those results whose 'filterText' matches the user's
  // typeahead (i.e. 'prefix'), [2] sorted according to a score of how
  // well their 'filterText' matches the user's typeahead, and [3] within groups
  // of equivalently-scored suggestions, sorted according to 'sortText'.
  const prefix = findAtomWordPrefix(request.editor, request.bufferPosition);

  // Step [1]: filter based on the user's typeahead. Users love typing just a
  // few characters and having it match camelHumps or similar. SublimeText and
  // VSCode and the other major IDEs do this too. It's a gnarly dynamic-
  // programming problem so we're happy to leave it to the third-party library
  // fuzzaldrinPlus. Except: fuzzaldrinPlus by default sorts shorter suggestions
  // ahead of longer ones, e.g. for typeahead 'g' it scores 'genZoo' higher than
  // 'genAlpha'. Our only way to defeat that is by artificially padding out the
  // filter text to 40 characters. (That's an arbitrary hack, but good enough,
  // and cheaper than doing one pass to for max-length and another to pad).
  //
  // Also, fuzzaldrinPlus will give matches with very low scores. We'll
  // arbitrarily pick a threshold and reject ones below that.
  const SCORE_THRESHOLD = 0.1;
  //
  // While we're here, for sake of AutocompletePlus, each item also needs its
  // 'replacementPrefix' updated, because that's what AutcompletePlus uses to
  // to decide which characters to replace in the editor buffer.
  //
  // This 'reduce' takes ~25ms for 1000 items, largely in the scoring. The rest
  // of the function takes negligible time.

  const baseScore = prefix === '' ? 1 : fuzzaldrinPlus.score(prefix, prefix);

  const items: Array<{filterScore: number, completion: Completion}> = [];
  for (const item of firstResult.items) {
    // If there are text edits, the first one will be used for scoring purposes.
    const firstTextEdit =
      item.textEdits != null && item.textEdits.length > 0
        ? item.textEdits[0].newText
        : null;
    const text =
      // flowlint-next-line sketchy-null-string:off
      item.displayText || item.snippet || item.text || firstTextEdit || '';
    // flowlint-next-line sketchy-null-string:off
    const filterText = padEnd(item.filterText || text, 40, ' ');
    // If no prefix, then include all items and avoid doing work to score.
    const filterScore: number =
      prefix === '' ? 1 : fuzzaldrinPlus.score(filterText, prefix);
    // Score of 0 means the item fails the filter.
    if (filterScore === 0) {
      continue;
    }
    // Low score ratio indicates it's passes the filter, but not very well.
    if (filterScore / baseScore < SCORE_THRESHOLD) {
      continue;
    }
    const completion: Completion = {
      ...item,
      // flowlint-next-line sketchy-null-string:off
      sortText: item.sortText || text,
    };
    // If there are no textEdits, then a replacement prefix is needed.
    if (firstTextEdit == null) {
      completion.replacementPrefix = prefix;
    }
    items.push({filterScore, completion});
  }

  // Step [2+3]: sort by filterScore, and within that by sortText. We do a sort
  // that's basically alphabetical/ascii except that (like VisualStudio) we sort
  // underscore at the end rather than the start, to reflect the common cross-
  // language idiom that underscore functions are "lesser".
  items.sort((itemA, itemB) => {
    if (itemA.filterScore < itemB.filterScore) {
      return 1;
    } else if (itemA.filterScore > itemB.filterScore) {
      return -1;
    } else {
      const a = itemA.completion.sortText;
      const b = itemB.completion.sortText;
      invariant(a != null && b != null);
      if (a.startsWith('_') === b.startsWith('_')) {
        return a.localeCompare(b);
      } else if (a.startsWith('_')) {
        return 1;
      } else {
        return -1;
      }
    }
  });

  return {...firstResult, items: items.map(item => item.completion)};
}

// Gotta be careful not to mutate here or we could mess up the cache for
// subsequent requests.
export function updateAutocompleteResultRanges(
  originalRequest: atom$AutocompleteRequest,
  currentRequest: atom$AutocompleteRequest,
  cachedResult: AutocompleteResult,
): AutocompleteResult {
  const needsUpdate = cachedResult.items.some(
    item => item.textEdits != null && item.textEdits.length > 0,
  );
  if (!needsUpdate) {
    return cachedResult;
  }

  const items = cachedResult.items.map(item => {
    if (item.textEdits == null || item.textEdits.length === 0) {
      return item;
    }

    const textEdits = item.textEdits.map(textEdit => {
      const oldRange = textEdit.oldRange;
      if (
        oldRange.end.column === originalRequest.bufferPosition.column &&
        oldRange.end.row === originalRequest.bufferPosition.row
      ) {
        return {
          ...textEdit,
          oldRange: new Range(
            oldRange.start,
            new Point(oldRange.end.row, currentRequest.bufferPosition.column),
          ),
        };
      } else {
        return textEdit;
      }
    });

    return {...item, textEdits};
  });

  return {
    ...cachedResult,
    items,
  };
}
