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

import {track} from './track';

const HISTOGRAM_TRACKER_KEY = 'performance-histogram';

class Bucket {
  _count: number;
  _sum: number;

  constructor() {
    this._count = 0;
    this._sum = 0;
  }

  addValue(value: number): void {
    this._sum += value;
    this._count++;
  }

  getCount(): number {
    return this._count;
  }

  getAverage(): number {
    return this._count > 0 ? this._sum / this._count : 0;
  }

  clear(): void {
    this._count = 0;
    this._sum = 0;
  }
}

export class HistogramTracker {
  _eventName: string;
  _maxValue: number;
  _bucketSize: number;
  _buckets: Array<Bucket>;
  _intervalId: number;

  constructor(
    eventName: string,
    maxValue: number,
    numBuckets: number,
    intervalSeconds: number = 60,
  ) {
    this._eventName = eventName;
    this._maxValue = maxValue;
    this._bucketSize = maxValue / numBuckets;
    this._buckets = new Array(numBuckets);
    for (let i = 0; i < numBuckets; i++) {
      this._buckets[i] = new Bucket();
    }

    this._intervalId = setInterval(() => {
      // Potential race condition if intervalSeconds is too small.
      this.saveAnalytics();
    }, intervalSeconds * 1000);
  }

  dispose() {
    clearInterval(this._intervalId);
  }

  track(value: number): HistogramTracker {
    const bucket = Math.min(
      this._buckets.length - 1,
      Math.floor(value / this._bucketSize),
    );
    this._buckets[bucket].addValue(value);
    return this;
  }

  saveAnalytics(): void {
    for (let i = 0; i < this._buckets.length; i++) {
      const bucket = this._buckets[i];
      if (bucket.getCount() > 0 && track != null) {
        track(HISTOGRAM_TRACKER_KEY, {
          eventName: this._eventName,
          average: bucket.getAverage(),
          samples: bucket.getCount(),
        });
      }
    }
    this.clear();
  }

  clear(): void {
    for (let i = 0; i < this._buckets.length; i++) {
      this._buckets[i].clear();
    }
  }
}
