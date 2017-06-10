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

import type {HackCompletion, HackParameterDetails} from './rpc-types';
import type {
  Completion,
} from '../../nuclide-language-service/lib/LanguageService';

import {Point, Range} from 'simple-text-buffer';
import {
  sortAndFilterCompletions,
  getResultPrefix,
  getReplacementPrefix,
} from '../../nuclide-hack-common/lib/autocomplete';

export function convertCompletions(
  contents: string,
  offset: number,
  prefix: string,
  hackCompletions: Array<HackCompletion>,
): Array<Completion> {
  const completions = processCompletions(
    hackCompletions,
    contents,
    offset,
    prefix,
  );
  return sortAndFilterCompletions(completions, prefix);
}

function matchTypeOfType(type: string): string {
  // strip parens if present
  if (type[0] === '(' && type[type.length - 1] === ')') {
    return type.substring(1, type.length - 1);
  }
  return type;
}

function escapeName(name: string): string {
  return name.replace(/\\/g, '\\\\');
}

function paramSignature(params: Array<HackParameterDetails>): ?string {
  const paramStrings = params.map(param => `${param.type} ${param.name}`);
  return `(${paramStrings.join(', ')})`;
}

function matchSnippet(
  name: string,
  params: ?Array<HackParameterDetails>,
): string {
  const escapedName = escapeName(name);
  if (params != null) {
    // Construct the snippet: e.g. myFunction(${1:$arg1}, ${2:$arg2});
    const paramsString = params
      .map((param, index) => `\${${index + 1}:${param.name}}`)
      .join(', ');
    return `${escapedName}(${paramsString})`;
  } else {
    return escapedName;
  }
}

function processCompletions(
  completionsResponse: Array<HackCompletion>,
  contents: string,
  offset: number,
  defaultPrefix: string,
): Array<Completion> {
  const lineEndOrNotFound = contents.indexOf('\n', offset);
  const lineEnd = lineEndOrNotFound !== -1
    ? lineEndOrNotFound
    : contents.length;
  const contentsRestOfLine = contents.substring(offset, lineEnd);
  const nextCharIndex = contentsRestOfLine.search(/\S/);
  const alreadyHasParams =
    nextCharIndex !== -1 && contentsRestOfLine[nextCharIndex] === '(';

  return completionsResponse.map((completion: HackCompletion) => {
    const {name, type, func_details} = completion;
    const resultPrefix = getResultPrefix(contents, offset, name);
    const commonResult = {
      displayText: name,
      replacementPrefix: getReplacementPrefix(resultPrefix, defaultPrefix),
      description: matchTypeOfType(type),
    };
    // The typechecker only gives us suggestions that are valid in the
    // current scope - so, if what the user typed didn't start with the
    // namespace (which would lead to us having a resultPrefix), we don't
    // want to put the namespace in the replacement.
    const scopedName = resultPrefix === '' ? name.split('\\').pop() : name;
    if (func_details != null) {
      const completionParams = alreadyHasParams ? null : func_details.params;
      return {
        ...commonResult,
        snippet: matchSnippet(scopedName, completionParams),
        leftLabel: func_details.return_type,
        rightLabel: paramSignature(func_details.params),
        type: 'function',
      };
    } else {
      return {
        ...commonResult,
        snippet: matchSnippet(scopedName),
        rightLabel: matchTypeOfType(type),
      };
    }
  });
}

const FIELD_ACCESSORS = ['->', '::'];
const PREFIX_LOOKBACK = Math.max.apply(
  null,
  FIELD_ACCESSORS.map(prefix => prefix.length),
);

/**
 * Returns true if `bufferPosition` is prefixed with any of the passed `checkPrefixes`.
 */
export function hasPrefix(
  buffer: simpleTextBuffer$TextBuffer,
  bufferPosition: atom$Point,
): boolean {
  const priorChars = buffer.getTextInRange(
    new Range(
      new Point(bufferPosition.row, bufferPosition.column - PREFIX_LOOKBACK),
      bufferPosition,
    ),
  );
  return FIELD_ACCESSORS.some(prefix => priorChars.endsWith(prefix));
}
