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

import fuzzaldrinPlus from 'fuzzaldrin-plus';

import type {
  AutocompleteResult,
} from '../../nuclide-language-service/lib/LanguageService';

// A simple heuristic for identifier names in JavaScript.
export const JAVASCRIPT_IDENTIFIER_REGEX = /[$_a-zA-Z][$_\w]*/g;

export const JAVASCRIPT_WHOLE_STRING_IDENTIFIER_REGEX = /^[$_a-zA-Z][$_\w]*$/;

const identifierOrNumber = '[a-zA-Z0-9_$]+';

function makeStrRegex(delimiter: string): string {
  const d = delimiter;
  // Each run of four backslashes ends up as just one backslash. We need to escape once for the
  // string literal here, and once for the RegExp compilation.
  return `${d}(\\\\.|[^${d}\\\\])*${d}`;
}

const strRegexes = ['`', "'", '"'].map(makeStrRegex);

const regexStrings = []
  .concat(strRegexes, [identifierOrNumber])
  .map(s => `(${s})`);

export const JAVASCRIPT_WORD_REGEX = new RegExp(regexStrings.join('|'), 'g');

export function getReplacementPrefix(originalPrefix: string): string {
  // Ignore prefix unless it's an identifier (this keeps us from eating leading
  // dots, colons, etc).
  return JAVASCRIPT_WHOLE_STRING_IDENTIFIER_REGEX.test(originalPrefix)
    ? originalPrefix
    : '';
}

export function shouldFilter(
  lastRequest: atom$AutocompleteRequest,
  currentRequest: atom$AutocompleteRequest,
  charsSinceLastRequest: number,
): boolean {
  const prefixIsIdentifier = JAVASCRIPT_WHOLE_STRING_IDENTIFIER_REGEX.test(
    currentRequest.prefix,
  );
  const previousPrefixIsDot = /^\s*\.\s*$/.test(lastRequest.prefix);
  const prefixLengthDifference =
    currentRequest.prefix.length - lastRequest.prefix.length;
  const startsWithPrevious = currentRequest.prefix.startsWith(
    lastRequest.prefix,
  );

  return (
    prefixIsIdentifier &&
    ((previousPrefixIsDot &&
      currentRequest.prefix.length === charsSinceLastRequest) ||
      (startsWithPrevious && prefixLengthDifference === charsSinceLastRequest))
  );
}

export function filterResultsByPrefix(
  prefix: string,
  results: AutocompleteResult,
): AutocompleteResult {
  const replacementPrefix = getReplacementPrefix(prefix);
  const resultsWithCurrentPrefix = results.items.map(result => {
    return {
      ...result,
      replacementPrefix,
    };
  });
  let items;
  // fuzzaldrin-plus filters everything when the query is empty.
  if (replacementPrefix === '') {
    items = resultsWithCurrentPrefix;
  } else {
    items = fuzzaldrinPlus.filter(resultsWithCurrentPrefix, replacementPrefix, {
      key: 'displayText',
    });
  }
  return {...results, items};
}
