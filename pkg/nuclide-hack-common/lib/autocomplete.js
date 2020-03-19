/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import {Point, Range} from 'simple-text-buffer';

import type {Completion} from '../../nuclide-language-service/lib/LanguageService';
import {wordAtPositionFromBuffer} from 'nuclide-commons/range';

import {HACK_WORD_REGEX} from './constants';

import invariant from 'assert';

const MATCH_PREFIX_CASE_SENSITIVE_SCORE = 6;
const MATCH_PREFIX_CASE_INSENSITIVE_SCORE = 4;
const MATCH_TOKEN_CASE_SENSITIVE_SCORE = 2;
const MATCH_TOKEN_CASE_INSENSITIVE_SCORE = 0;
const MATCH_PRIVATE_FUNCTION_PENALTY = -4;
const MATCH_APLHABETICAL_SCORE = 1;

export function compareHackCompletions(
  token: string,
): (completion1: Completion, completion2: Completion) => number {
  const tokenLowerCase = token.toLowerCase();

  return (completion1: Completion, completion2: Completion) => {
    // Prefer completions with larger prefixes.
    invariant(completion1.replacementPrefix != null);
    invariant(completion2.replacementPrefix != null);
    const prefixComparison =
      completion2.replacementPrefix.length -
      completion1.replacementPrefix.length;
    if (prefixComparison !== 0) {
      return prefixComparison;
    }

    invariant(completion1.displayText != null);
    invariant(completion2.displayText != null);
    const texts: Array<string> = [
      completion1.displayText,
      completion2.displayText,
    ];
    const scores = texts.map((text, i) => {
      if (text.startsWith(token)) {
        // Matches starting with the prefix gets the highest score.
        return MATCH_PREFIX_CASE_SENSITIVE_SCORE;
      } else if (text.toLowerCase().startsWith(tokenLowerCase)) {
        // Ignore case score matches gets a good score.
        return MATCH_PREFIX_CASE_INSENSITIVE_SCORE;
      }

      let score;
      if (text.indexOf(token) !== -1) {
        // Small score for a match that contains the token case-sensitive.
        score = MATCH_TOKEN_CASE_SENSITIVE_SCORE;
      } else {
        // Zero score for a match that contains the token without case-sensitive matching.
        score = MATCH_TOKEN_CASE_INSENSITIVE_SCORE;
      }

      // Private functions gets negative score.
      if (text.startsWith('_')) {
        score += MATCH_PRIVATE_FUNCTION_PENALTY;
      }
      return score;
    });
    // Finally, consider the alphabetical order, but not higher than any other score.
    if (texts[0] < texts[1]) {
      scores[0] += MATCH_APLHABETICAL_SCORE;
    } else {
      scores[1] += MATCH_APLHABETICAL_SCORE;
    }
    return scores[1] - scores[0];
  };
}

// Returns the length of the largest match between a suffix of contents
// and a prefix of match.
function matchLength(contents: string, match: string): number {
  for (let i = match.length; i > 0; i--) {
    const toMatch = match.substring(0, i);
    if (contents.endsWith(toMatch)) {
      return i;
    }
  }
  return 0;
}

export function sortAndFilterCompletions(
  completions: Array<Completion>,
  prefix: string,
): Array<Completion> {
  // Filter out the completions that do not contain the prefix as a token in the match text case
  // insentively.
  const tokenLowerCase = prefix.toLowerCase();

  const hackCompletionsComparator = compareHackCompletions(prefix);
  return (
    completions
      // The returned completions may have unrelated results, even though the offset
      // is set on the end of the prefix.
      .filter(completion => {
        invariant(completion.displayText != null);
        return (
          completion.displayText.toLowerCase().indexOf(tokenLowerCase) >= 0
        );
      })
      // Sort the auto-completions based on a scoring function considering:
      // case sensitivity, position in the completion, private functions and alphabetical order.
      .sort((completion1, completion2) =>
        hackCompletionsComparator(completion1, completion2),
      )
  );
}

export function getResultPrefix(
  contents: string,
  offset: number,
  name: string,
): string {
  const contentsLine = contents
    .substring(contents.lastIndexOf('\n', offset - 1) + 1, offset)
    .toLowerCase();

  return contents.substring(
    offset - matchLength(contentsLine, name.toLowerCase()),
    offset,
  );
}

export function getReplacementPrefix(
  resultPrefix: string,
  defaultPrefix: string,
): string {
  return resultPrefix === '' ? defaultPrefix : resultPrefix;
}

export function findHackPrefix(
  buffer: simpleTextBuffer$TextBuffer | atom$TextBuffer,
  position: atom$Point,
): string {
  // We use custom wordRegex to adopt php variables starting with $.
  const currentRange = wordAtPositionFromBuffer(
    buffer,
    new Point(position.row, Math.max(0, position.column - 1)),
    HACK_WORD_REGEX,
  );
  if (currentRange == null) {
    return '';
  }
  // Current word might go beyond the cursor, so we cut it.
  const range = new Range(currentRange.range.start, position);
  const prefix = buffer.getTextInRange(range).trim();
  // Prefix could just be $ or ends with string literal.
  if (prefix === '$' || !/[\W]$/.test(prefix)) {
    return prefix;
  } else {
    return '';
  }
}
