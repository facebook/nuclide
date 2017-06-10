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

import type {Observable} from 'rxjs';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {isPromise} from 'nuclide-commons/promise';
import performanceNow from 'nuclide-commons/performanceNow';
import {track as rawTrack} from './track';

export {HistogramTracker} from './HistogramTracker';

export type TrackingEvent = {
  type: string,
  data?: Object,
};

/**
 * Track a set of values against a named event.
 * Analytics will be batched and processed asynchronously in the background.
 *
 * @param eventName Name of the event to be tracked.
 * @param values The object containing the data to track.
 */
export function track(
  eventName: string,
  values?: {[key: string]: mixed},
): void {
  rawTrack(eventName, values || {});
}

/**
 * Same as `track`, except this is guaranteed to send immediately.
 * The returned promise will resolve when the request completes (or reject on failure).
 */
export function trackImmediate(
  eventName: string,
  values?: {[key: string]: mixed},
): Promise<mixed> {
  return rawTrack(eventName, values || {}, true) || Promise.resolve();
}

/**
 * An alternative interface for `track` that accepts a single event object. This is particularly
 * useful when dealing with streams (Observables).
 */
export function trackEvent(event: TrackingEvent): void {
  track(event.type, event.data);
}

/**
 * Track each event in a stream of TrackingEvents.
 */
export function trackEvents(events: Observable<TrackingEvent>): IDisposable {
  return new UniversalDisposable(events.subscribe(trackEvent));
}

const PERFORMANCE_EVENT = 'performance';

export class TimingTracker {
  _eventName: string;
  _startTime: number;

  constructor(eventName: string) {
    this._eventName = eventName;
    this._startTime = performanceNow();
  }

  onError(error: Error): void {
    this._trackTimingEvent(error);
  }

  onSuccess(): void {
    this._trackTimingEvent(/* error */ null);
  }

  _trackTimingEvent(exception: ?Error): void {
    track(PERFORMANCE_EVENT, {
      duration: Math.round(performanceNow() - this._startTime).toString(),
      eventName: this._eventName,
      error: exception ? '1' : '0',
      exception: exception ? exception.toString() : '',
    });
  }
}

export function startTracking(eventName: string): TimingTracker {
  return new TimingTracker(eventName);
}

/**
 * Reports analytics including timing for a single operation.
 *
 * Usage:
 *
 * analytics.trackTiming('my-package-some-long-operation' () => doit());
 *
 * Returns (or throws) the result of the operation.
 */
export function trackTiming<T>(eventName: string, operation: () => T): T {
  const tracker = startTracking(eventName);

  try {
    const result = operation();

    if (isPromise(result)) {
      // Atom uses a different Promise implementation than Nuclide, so the following is not true:
      // invariant(result instanceof Promise);

      // For the method returning a Promise, track the time after the promise is resolved/rejected.
      return (result: any).then(
        value => {
          tracker.onSuccess();
          return value;
        },
        reason => {
          tracker.onError(reason instanceof Error ? reason : new Error(reason));
          return Promise.reject(reason);
        },
      );
    } else {
      tracker.onSuccess();
      return result;
    }
  } catch (error) {
    tracker.onError(error);
    throw error;
  }
}
