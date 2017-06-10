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

import type {ClangCompletion} from '../../nuclide-clang-rpc/lib/rpc-types';

import {Point} from 'atom';
import fuzzaldrinPlus from 'fuzzaldrin-plus';
import AutocompleteCacher from '../../commons-atom/AutocompleteCacher';
import {arrayFindLastIndex} from 'nuclide-commons/collection';
import {track, trackTiming} from '../../nuclide-analytics';
import {ClangCursorToDeclarationTypes} from '../../nuclide-clang-rpc';
import {getCompletions} from './libclang';

const MAX_LINE_LENGTH = 120;
const TAB_LENGTH = 2;
const VALID_EMPTY_SUFFIX = /(->|\.|::|\()$/;

const ClangCursorToAutocompletionTypes = Object.freeze({
  STRUCT_DECL: 'class',
  UNION_DECL: 'class',
  CLASS_DECL: 'class',
  ENUM_DECL: 'class',
  FIELD_DECL: 'property',
  ENUM_CONSTANT_DECL: 'constant',
  FUNCTION_DECL: 'function',
  VAR_DECL: 'variable',
  PARM_DECL: 'variable',
  OBJC_INTERFACE_DECL: 'class',
  OBJC_CATEGORY_DECL: 'class',
  OBJC_PROTOCOL_DECL: 'class',
  OBJC_PROPERTY_DECL: 'property',
  OBJC_IVAR_DECL: 'variable',
  OBJC_INSTANCE_METHOD_DECL: 'method',
  OBJC_CLASS_METHOD_DECL: 'method',
  OBJC_IMPLEMENTATION_DECL: 'class',
  OBJC_CATEGORY_IMPL_DECL: 'class',
  TYPEDEF_DECL: 'type',
  CXX_METHOD: 'method',
  CONSTRUCTOR: 'method',
  DESTRUCTOR: 'method',
  FUNCTION_TEMPLATE: 'function',
  CLASS_TEMPLATE: 'class',
  OVERLOAD_CANDIDATE: 'function',
});

function getCompletionBody(
  completion: ClangCompletion,
  columnOffset: number,
  indentation: number,
): string {
  const inlineBody = getCompletionBodyInline(completion);
  const multiLineBody = getCompletionBodyMultiLine(
    completion,
    columnOffset,
    indentation,
  );

  if (columnOffset + inlineBody.length > MAX_LINE_LENGTH && multiLineBody) {
    return multiLineBody;
  }
  return inlineBody;
}

function getCompletionBodyMultiLine(
  completion: ClangCompletion,
  columnOffset: number,
  indentation: number,
): ?string {
  // Filter out whitespace chunks.
  const chunks = completion.chunks.filter(chunk => chunk.spelling.trim());

  // We only handle completions in which non-placeholder and placeholder
  // chunks alternate, starting with non-placeholder chunk.
  if (chunks.length % 2) {
    return null;
  }

  // Group non-placeholders and placeholders into groups of two.
  // One of each.
  const args = [];
  for (let i = 0, n = chunks.length / 2; i < n; ++i) {
    const firstChunk = chunks[i * 2];
    const secondChunk = chunks[i * 2 + 1];

    if (firstChunk.isPlaceHolder || !secondChunk.isPlaceHolder) {
      return null;
    }

    // If firstChunk ends with colon remove it because we add it manually later.
    let text = firstChunk.spelling;
    const placeholder = secondChunk.spelling;
    if (text.endsWith(':')) {
      text = text.substring(0, text.length - 1);
    }

    // All rows but the first one should be indented at least 2 extra levels.
    // To get that we add dummy leading spaces to those rows.
    if (i > 0) {
      text = ' '.repeat(2 * TAB_LENGTH) + text;
    }

    args.push({
      text,
      placeholder,
      offset: i === 0 ? columnOffset : indentation * TAB_LENGTH,
    });
  }

  return _convertArgsToMultiLineSnippet(args);
}

function _convertArgsToMultiLineSnippet(
  args: Array<{
    text: string,
    placeholder: string,
    offset: number,
  }>,
): string {
  // We have two types of multine line method calls.
  //
  // 1. Here first argument is the longest, so everything can be
  //    aligned nicely:
  // [self ArgumentOne:arg1
  //              arg2:arg2
  //         Argument3:arg3]
  //
  // 2. Here first argument is not the longest, but we still don't move it.
  //    Only rule here is that colons in remaining rows are aligned:
  // [self Arg1:arg1
  //          arg2:arg2
  //     Argument3:arg3]
  //

  const colonPosition = Math.max.apply(
    null,
    args.map(arg => arg.offset + arg.text.length),
  );

  return args.reduce((body, arg, index) => {
    const spacesCnt = index === 0
      ? 0
      : colonPosition - arg.offset - arg.text.length;
    if (spacesCnt < 0) {
      throw Error('This is a bug! Spaces count is negative.');
    }

    const line = `${' '.repeat(spacesCnt)}${arg.text}:\${${index + 1}:${arg.placeholder}}\n`;
    if (index > 0 && line[colonPosition - arg.offset] !== ':') {
      throw Error('This is a bug! Colons are not aligned!');
    }
    return body + line;
  }, '');
}

function getCompletionBodyInline(completion: ClangCompletion): string {
  // Make a copy to avoid mutating the original.
  const chunks = [...completion.chunks];

  // Merge everything between the last non-optional placeholder
  // and the last optional placeholder into one big optional.
  const lastOptional = arrayFindLastIndex(chunks, chunk =>
    Boolean(chunk.isOptional && chunk.isPlaceHolder),
  );
  if (lastOptional !== -1) {
    const lastNonOptional = arrayFindLastIndex(chunks, chunk =>
      Boolean(!chunk.isOptional && chunk.isPlaceHolder),
    );
    if (lastNonOptional !== -1 && lastNonOptional < lastOptional) {
      let mergedSpelling = '';
      for (let i = lastNonOptional + 1; i <= lastOptional; i++) {
        mergedSpelling += chunks[i].spelling;
      }
      chunks.splice(lastNonOptional + 1, lastOptional - lastNonOptional, {
        spelling: mergedSpelling,
        isPlaceHolder: true,
        isOptional: true,
      });
    }
  }

  let body = '';
  let placeHolderCnt = 0;
  chunks.forEach(chunk => {
    if (chunk.isPlaceHolder) {
      placeHolderCnt++;
      let spelling = chunk.spelling;
      if (chunk.isOptional) {
        spelling = `[${spelling}]`;
      }
      body += '${' + placeHolderCnt + ':' + spelling + '}';
    } else {
      body += chunk.spelling;
    }
  });
  return body;
}

function getCompletionPrefix(editor: atom$TextEditor): string {
  const cursor = editor.getLastCursor();
  const range = cursor.getCurrentWordBufferRange({
    wordRegex: cursor.wordRegExp({includeNonWordCharacters: false}),
  });

  // Current word might go beyond the cursor, so we cut it.
  range.end = new Point(cursor.getBufferRow(), cursor.getBufferColumn());
  return editor.getTextInBufferRange(range).trim();
}

type ClangAutocompleteSuggestion = atom$AutocompleteSuggestion & {
  filterText: string,
};

export default class AutocompleteHelpers {
  static _cacher = new AutocompleteCacher(
    AutocompleteHelpers._getAutocompleteSuggestions,
    {
      updateResults(request, results) {
        const {editor} = request;
        const prefix = getCompletionPrefix(editor);
        // We hit the results limit, so there may be unlisted results.
        // Needs to match the value in clang_server.py.
        if (results.length === 200) {
          return null;
        }
        return fuzzaldrinPlus
          .filter(results, prefix, {key: 'filterText'})
          .map(result => ({...result, replacementPrefix: prefix}));
      },
    },
  );

  static getAutocompleteSuggestions(
    request: atom$AutocompleteRequest,
  ): Promise<Array<atom$AutocompleteSuggestion>> {
    return trackTiming('nuclide-clang-atom.autocomplete', async () => {
      const results = await AutocompleteHelpers._cacher.getSuggestions(request);
      if (results != null) {
        return [...results];
      }
      return [];
    });
  }

  static async _getAutocompleteSuggestions(
    request: atom$AutocompleteRequest,
  ): Promise<?Array<ClangAutocompleteSuggestion>> {
    const {editor, bufferPosition: {row, column}, activatedManually} = request;
    const prefix = getCompletionPrefix(editor);
    // Only autocomplete empty strings when it's a method (a.?, a->?) or qualifier (a::?),
    // or function call (f(...)).
    if (!activatedManually && prefix === '') {
      const wordPrefix = editor.getLastCursor().getCurrentWordPrefix();
      if (!VALID_EMPTY_SUFFIX.test(wordPrefix)) {
        return null;
      }
    }

    const indentation = editor.indentationForBufferRow(row);
    const data = await getCompletions(editor, prefix);
    if (data == null) {
      return null;
    }

    track('clang.autocompleteResults', {
      path: editor.getPath(),
      prefix: prefix.substr(0, 20), // avoid logging too much!
      completions: data.length,
    });

    return data.map(completion => {
      let snippet;
      let displayText;
      // For function argument completions, strip out everything before the current parameter.
      // Ideally we'd use the replacement prefix, but this is a hard problem in C++:
      //   e.g. min<decltype(x)>(x, y) is a perfectly valid function call.
      if (completion.cursor_kind === 'OVERLOAD_CANDIDATE') {
        const curParamIndex = completion.chunks.findIndex(
          x => x.kind === 'CurrentParameter',
        );
        if (curParamIndex !== -1) {
          completion.chunks.splice(0, curParamIndex);
          snippet = getCompletionBody(completion, column, indentation);
        } else {
          // Function had no arguments.
          snippet = ')';
        }
        displayText = completion.spelling;
      } else {
        snippet = getCompletionBody(completion, column, indentation);
      }
      const rightLabel = completion.cursor_kind
        ? ClangCursorToDeclarationTypes[completion.cursor_kind]
        : null;
      const type = completion.cursor_kind
        ? ClangCursorToAutocompletionTypes[completion.cursor_kind]
        : null;
      return {
        snippet,
        displayText,
        replacementPrefix: prefix,
        type,
        leftLabel: completion.result_type,
        rightLabel,
        description: completion.brief_comment || completion.result_type,
        filterText: completion.typed_name,
      };
    });
  }
}

export const __test__ = {
  getCompletionBodyMultiLine,
  getCompletionBodyInline,
};
