/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

import type {
  HackCompletion,
  HackParameterDetails,
} from './rpc-types';
import type {Completion} from '../../nuclide-language-service/lib/LanguageService';

import {Point, Range} from 'simple-text-buffer';
import invariant from 'assert';
import {wordAtPositionFromBuffer} from '../../commons-node/range';
import {HACK_WORD_REGEX} from './HackHelpers';

export function convertCompletions(
  contents: string,
  offset: number,
  prefix: string,
  hackCompletions: ?Array<HackCompletion>,
): Array<Completion> {
  if (hackCompletions == null) {
    return [];
  }

  // Filter out the completions that do not contain the prefix as a token in the match text case
  // insentively.
  const tokenLowerCase = prefix.toLowerCase();

  const hackCompletionsComparator = compareHackCompletions(prefix);
  return processCompletions(hackCompletions, contents, offset, prefix)
    // The returned completions may have unrelated results, even though the offset
    // is set on the end of the prefix.
    .filter(completion => {
      invariant(completion.displayText != null);
      return completion.displayText.toLowerCase().indexOf(tokenLowerCase) >= 0;
    })
    // Sort the auto-completions based on a scoring function considering:
    // case sensitivity, position in the completion, private functions and alphabetical order.
    .sort((completion1, completion2) =>
      hackCompletionsComparator(completion1, completion2));
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

function matchSnippet(name: string, params: ?Array<HackParameterDetails>): string {
  const escapedName = escapeName(name);
  if (params != null) {
    // Construct the snippet: e.g. myFunction(${1:$arg1}, ${2:$arg2});
    const paramsString = params.map(
      (param, index) => `\${${index + 1}:${param.name}}`).join(', ');
    return `${escapedName}(${paramsString})`;
  } else {
    return escapedName;
  }
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

function processCompletions(
  completionsResponse: Array<HackCompletion>,
  contents: string,
  offset: number,
  defaultPrefix: string,
): Array<Completion> {
  const contentsLine = contents.substring(
    contents.lastIndexOf('\n', offset - 1) + 1,
    offset).toLowerCase();

  const lineEndOrNotFound = contents.indexOf('\n', offset);
  const lineEnd =
    lineEndOrNotFound !== -1 ? lineEndOrNotFound : contents.length;
  const contentsRestOfLine = contents.substring(offset, lineEnd);
  const nextCharIndex = contentsRestOfLine.search(/\S/);
  const alreadyHasParams =
    nextCharIndex !== -1 && contentsRestOfLine[nextCharIndex] === '(';

  return completionsResponse.map((completion: HackCompletion) => {
    const {name, type, func_details} = completion;
    const resultPrefix = contents.substring(
      offset - matchLength(contentsLine, name.toLowerCase()),
      offset);
    const commonResult = {
      displayText: name,
      replacementPrefix: resultPrefix === '' ? defaultPrefix : resultPrefix,
      description: matchTypeOfType(type),
    };
    // The typechecker only gives us suggestions that are valid in the
    // current scope - so, if what the user typed didn't start with the
    // namespace (which would lead to us having a resultPrefix), we don't
    // want to put the namespace in the replacement.
    const scopedName = resultPrefix === '' ? name.split('\\').pop() : name;
    if (func_details != null) {
      const completionParams =
        alreadyHasParams ? null : func_details.params;
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
      completion2.replacementPrefix.length - completion1.replacementPrefix.length;
    if (prefixComparison !== 0) {
      return prefixComparison;
    }

    invariant(completion1.displayText != null);
    invariant(completion2.displayText != null);
    const texts: Array<string> = [completion1.displayText, completion2.displayText];
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

const FIELD_ACCESSORS = ['->', '::'];
const PREFIX_LOOKBACK = Math.max.apply(null, FIELD_ACCESSORS.map(prefix => prefix.length));

/**
 * Returns true if `bufferPosition` is prefixed with any of the passed `checkPrefixes`.
 */
export function hasPrefix(
    buffer: simpleTextBuffer$TextBuffer,
    bufferPosition: atom$Point,
  ): boolean {
  const priorChars = buffer.getTextInRange(new Range(
    new Point(bufferPosition.row, bufferPosition.column - PREFIX_LOOKBACK),
    bufferPosition,
  ));
  return FIELD_ACCESSORS.some(prefix => priorChars.endsWith(prefix));
}

export function findHackPrefix(
  buffer: simpleTextBuffer$TextBuffer,
  position: atom$Point,
): string {
  // We use custom wordRegex to adopt php variables starting with $.
  const currentRange = wordAtPositionFromBuffer(
    buffer, position, HACK_WORD_REGEX);
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
