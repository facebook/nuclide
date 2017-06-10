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

import Heap from 'heap';

import type {QueryScore} from './QueryScore';
import {scoreComparator, inverseScoreComparator} from './utils';

/**
 * This data structure is designed to hold the top K scores from a collection of
 * N scores where scores become available one at a time. The expectation is that
 * N will be much, much greater than K.
 *
 * insert() is O(lg K)
 * getTopScores() is O(K lg K)
 *
 * Therefore, finding the top K scores from a collection of N elements should be
 * O(N lg K).
 */
export default class TopScores {
  _capacity: number;
  _full: boolean;
  _heap: Heap;
  _min: ?QueryScore;

  constructor(capacity: number) {
    this._capacity = capacity;
    this._full = false;
    this._heap = new Heap(inverseScoreComparator);
    this._min = null;
  }

  insert(score: QueryScore) {
    if (this._full && this._min) {
      const cmp = scoreComparator(score, this._min);
      if (cmp < 0) {
        this._doInsert(score);
      }
    } else {
      this._doInsert(score);
    }
  }

  _doInsert(score: QueryScore) {
    if (this._full) {
      this._heap.replace(score);
    } else {
      this._heap.insert(score);
      this._full = this._heap.size() === this._capacity;
    }
    this._min = this._heap.peek();
  }

  getSize(): number {
    return this._heap.size();
  }

  /**
   * @return an Array where Scores will be sorted in ascending order.
   */
  getTopScores(): Array<QueryScore> {
    const array = this._heap.toArray();
    array.sort(scoreComparator);
    return array;
  }
}
