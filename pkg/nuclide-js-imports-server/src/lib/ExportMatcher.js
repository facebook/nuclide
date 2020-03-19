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

import {
  Matcher,
  type MatcherOptions,
  type MatchResult,
} from 'nuclide-fuzzy-native';

/**
 * This class batches all adds/removes from the same tick into one batch add/remove call.
 * Since the Matcher class is a native node module, this is several orders of magnitude
 * faster when dealing with large sets of files (> 10000).
 */
export default class ExportMatcher {
  _matcher: Matcher = new Matcher([]);
  _batchScheduled: boolean = false;

  // true = add, false = delete
  _batch: Map<string, boolean> = new Map();

  add(item: string) {
    this._batch.set(item, true);
    this._schedule();
  }

  remove(item: string) {
    this._batch.set(item, false);
    this._schedule();
  }

  match(query: string, options?: MatcherOptions): Array<MatchResult> {
    // In practice, it's unlikely that we look for a match and mutate in the same tick.
    // But just in case...
    this._performBatch();
    return this._matcher.match(query, options);
  }

  _schedule(): void {
    if (!this._batchScheduled) {
      this._batchScheduled = true;
      process.nextTick(this._performBatch);
    }
  }

  _performBatch = () => {
    const toAdd = [];
    const toRemove = [];
    this._batch.forEach((added, item) => {
      if (added) {
        toAdd.push(item);
      } else {
        toRemove.push(item);
      }
    });
    this._matcher.addCandidates(toAdd);
    this._matcher.removeCandidates(toRemove);
    this._batch.clear();
    this._batchScheduled = false;
  };
}
