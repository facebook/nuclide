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

import nuclideUri from 'nuclide-commons/nuclideUri';

import type {QueryScore} from './QueryScore';

const NON_UPPERCASE_CHARS_REGEXP = /[^a-z0-9]/g;

function sanitize(str: string) {
  return str.toLowerCase().replace(NON_UPPERCASE_CHARS_REGEXP, '');
}

/**
 * Returns the score of the common subsequence between `needle` and `haystack` or -1 if there is
 * no common subsequence.
 * A lower number means `needle` is more relevant to `haystack`.
 */
function scoreCommonSubsequence(needle_: string, haystack_: string): number {
  // Sanitize the needle and haystack.
  const needle = sanitize(needle_);
  const haystack = sanitize(haystack_);
  if (needle.length === haystack.length) {
    return needle === haystack ? 0 : -1;
  }

  let needleIndex: number = 0;
  let haystackIndex: number = 0;
  let score: number = 0;
  let inGap: boolean = false;

  while (needleIndex < needle.length && haystackIndex < haystack.length) {
    if (needle[needleIndex] === haystack[haystackIndex]) {
      needleIndex++;
      haystackIndex++;
      inGap = false;
    } else {
      haystackIndex++;
      score += inGap ? 2 : 20;
      inGap = true;
    }
  }
  if (needleIndex >= needle.length) {
    return score + haystack.length + haystackIndex;
  }
  return -1;
}

const NOT_CAPITAL_LETTERS_REGEXP = /[^A-Z]/g;
/**
 * Checks if `needle` matches exactly the first character followed by all uppercase letters in
 * `haystack`.  E.g. 'fbide' matches 'FaceBookIntegratedDevelopmentEnvironment' and
 *                                   'faceBookIntegratedDevelopmentEnvironment'.
 */
function checkIfMatchesCamelCaseLetters(
  needle: string,
  haystack: string,
): boolean {
  const uppercase =
    haystack.substring(0, 1) +
    haystack.substring(1).replace(NOT_CAPITAL_LETTERS_REGEXP, '');
  return needle.toLowerCase() === uppercase.toLowerCase();
}

const CAPITAL_LETTERS_REGEXP = /[A-Z]/;
const IMPORTANT_DELIMITERS_REGEXP = /[_\-.]/;
function isLetterImportant(index: number, name: string): boolean {
  if (index <= 1) {
    return true;
  }
  if (CAPITAL_LETTERS_REGEXP.test(name[index])) {
    return true;
  }
  const previousCharacter = name[index - 1];
  if (IMPORTANT_DELIMITERS_REGEXP.test(previousCharacter)) {
    return true;
  }
  return false;
}
/**
 * FBIDE indexes each filepath by important characters it contains.
 * This is a temporary workaround that allow calculating important characters on the fly rather
 * than relying on the index. Once the index is implemented, consumers of this need to be updated.
 */
// TODO(jxg): replace with "important characters" index.
function importantCharactersForString(str: string): Set<string> {
  const importantCharacters = new Set();
  for (let index = 0; index < str.length; index++) {
    const char = str[index];
    if (!importantCharacters.has(char) && isLetterImportant(index, str)) {
      importantCharacters.add(char);
    }
  }
  return importantCharacters;
}

export const __test__ = {
  checkIfMatchesCamelCaseLetters,
  isLetterImportant,
  importantCharactersForString,
  scoreCommonSubsequence,
};

export default class QueryItem {
  _filepath: string;
  _filepathLowercase: string;
  _filename: string;
  _importantCharacters: Set<string>;

  constructor(filepath: string) {
    this._filepath = filepath;
    this._filepathLowercase = filepath.toLowerCase();
    this._filename = nuclideUri.basename(this._filepathLowercase);
    this._importantCharacters = importantCharactersForString(this._filename);
  }

  /**
   * Scores this object's string against the query given.
   *
   * To search:
   * a.) Cut the first letter off the query
   * b.) Lookup the list of terms which contain that letter (we indexed it earlier)
   * c.) Compare our query against each term in that list
   * d.) If our query is a common subsequence of one of the terms, add it to the results list
   * e.) While we compare our query, we keep track of a score:
   *     i.) The more gaps there are between matching characters, the higher the score
   *     ii.) The more letters which are the incorrect case, the higher the score
   *     iii.) Direct matches have a score of 0.
   *     iv.) The later we find out that we've matched, the higher the score
   *     v.) Longer terms have higher scores
   *     - The more your query is spreads out across the result,
   *       the less likely it is what you're looking for.
   *     - The shorter the result, the closer the length is to what you searched for,
   *       so it's more likely.
   *     - The earlier we find the match, the more likely it is to be what you're looking for.
   *     - The more cases of the characters that match, the more likely it is to be what you want.
   * f.) Sort the results by the score
   */
  score(query: string): ?QueryScore {
    const score = this._getScoreFor(query);
    return score == null
      ? null
      : {score, value: this._filepath, matchIndexes: []};
  }

  _getScoreFor(query: string): ?number {
    // Everything's an equally decent match for the empty string.
    if (query.length === 0) {
      return 0;
    }
    // Check if this a "possible result".
    // TODO consider building a directory-level index from important_character -> QueryItem,
    // akin to FBIDE's implementation.
    const firstChar = query[0].toLowerCase();
    if (!this._importantCharacters.has(firstChar)) {
      return null;
    }
    if (
      query.length >= 3 &&
      checkIfMatchesCamelCaseLetters(query, this._filename)
    ) {
      // If we match the uppercase characters of the filename, we should be ranked the highest
      return 0;
    } else {
      const sub = this._filepathLowercase.indexOf(query.toLowerCase());
      if (sub !== -1 && query.length < this._filename.length) {
        /**
         * We add the length of the term so we can be ranked alongside the
         * scores generated by `scoreCommonSubsequence` which also factors in the
         * length.
         * This way when you search for `EdisonController`,
         * EdisonController scores 0
         * EdixxsonController scores 40 (from `scoreCommonSubsequence` scoring)
         * SomethingBlahBlahEdisonController scores 50 from substring scoring
         * WebDecisionController scores 52 (from `scoreCommonSubsequence` scoring)
         */
        return sub + this._filename.length;
      } else {
        // TODO(jxg): Investigate extending scoreCommonSubsequence to consider subsequences
        // bidirectionally, or use (some proxy for) edit distance.
        const score = scoreCommonSubsequence(query, this._filename);
        if (score !== -1) {
          return score;
        }
      }
    }
    return null;
  }
}
