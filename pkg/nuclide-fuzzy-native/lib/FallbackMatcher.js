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

import type {
  MatcherOptions,
  MatchResult,
} from 'nuclide-prebuilt-libs/fuzzy-native';

import QueryItem from './QueryItem';
import TopScores from './TopScores';

/**
 * Fallback `Matcher` class compatible with the fuzzy-native implementation.
 * Note that the scores are different: 0 represents the best match while larger numbers are worse.
 */
export class Matcher {
  _queryItems: Map<string, QueryItem>;

  constructor(candidates: Array<string>) {
    this.setCandidates(candidates);
  }

  /**
   * Note: caseSensitive, numThreads, and recordMatchIndexes will be ignored.
   */
  match(query: string, options: MatcherOptions = {}): Array<MatchResult> {
    const topScores = new TopScores(options.maxResults || 0);
    this._queryItems.forEach(item => {
      const score = item.score(query);
      if (score != null) {
        topScores.insert(score);
      }
    });
    return topScores.getTopScores();
  }

  addCandidates(candidates: Array<string>): void {
    candidates.forEach(candidate => {
      this._queryItems.set(candidate, new QueryItem(candidate));
    });
  }

  removeCandidates(candidates: Array<string>): void {
    candidates.forEach(candidate => {
      this._queryItems.delete(candidate);
    });
  }

  setCandidates(candidates: Array<string>): void {
    this._queryItems = new Map();
    this.addCandidates(candidates);
  }
}
