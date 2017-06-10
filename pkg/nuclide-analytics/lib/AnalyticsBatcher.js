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

import type {TrackEvent} from './track';

import BatchProcessedQueue from 'nuclide-commons/BatchProcessedQueue';

const REPORTING_PERIOD = 1000;

type TrackCallback = (events: Array<TrackEvent>) => mixed;

export class AnalyticsBatcher {
  _queue: BatchProcessedQueue<TrackEvent>;
  _track: TrackCallback;

  constructor(track: TrackCallback) {
    this._track = track;
    this._queue = new BatchProcessedQueue(REPORTING_PERIOD, events => {
      this._handleBatch(events);
    });
  }

  _handleBatch(events: Array<TrackEvent>): void {
    this._track(events);
  }

  track(key: string, values: {[key: string]: mixed}): void {
    this._queue.add({key, values});
  }

  dispose(): void {
    this._queue.dispose();
  }
}
