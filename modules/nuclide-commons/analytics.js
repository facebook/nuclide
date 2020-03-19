/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {Observable} from 'rxjs';

import getDisplayName from './getDisplayName';
import UniversalDisposable from './UniversalDisposable';
import {isPromise} from './promise';
import performanceNow from './performanceNow';

export type SessionInfo = {
  id: string,
  start: number,
};

export type RawAnalyticsService = {
  track(
    eventName: string,
    values?: {[key: string]: mixed},
    immediate?: boolean,
  ): ?Promise<mixed>,
  isTrackSupported: () => boolean,
  setApplicationSessionObservable: (Observable<SessionInfo>) => void,
};

let rawAnalyticsService: RawAnalyticsService = {
  track(): ?Promise<mixed> {},
  isTrackSupported: () => false,
  setApplicationSessionObservable: (ob: Observable<SessionInfo>) => {},
};

export type TrackingEvent = {
  type: string,
  data?: Object,
};

export type TrackEvent = {
  key: string,
  values: {[key: string]: mixed},
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
  rawAnalyticsService.track(eventName, values || {});
}

export function isTrackSupported(): boolean {
  return rawAnalyticsService.isTrackSupported();
}

/**
 * Same as `track`, except this is guaranteed to send immediately.
 * The returned promise will resolve when the request completes (or reject on failure).
 */
export function trackImmediate(
  eventName: string,
  values?: {[key: string]: mixed},
): Promise<mixed> {
  return (
    rawAnalyticsService.track(eventName, values || {}, true) ||
    Promise.resolve()
  );
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

/**
 * A sampled version of track that only tracks every 1/sampleRate calls.
 */
export function trackSampled(
  eventName: string,
  sampleRate: number,
  values?: {[key: string]: mixed},
): void {
  if (Math.random() * sampleRate <= 1) {
    rawAnalyticsService.track(eventName, {
      ...values,
      sample_rate: sampleRate,
    });
  }
}

const PERFORMANCE_EVENT = 'performance';
const canMeasure = typeof performance !== 'undefined';
export class TimingTracker {
  static eventCount = 0;

  _eventName: string;
  _startTime: number;
  _startMark: string;
  _values: {[key: string]: mixed};

  constructor(eventName: string, values: {[key: string]: mixed}) {
    this._eventName = eventName;
    this._startMark = `${this._eventName}_${TimingTracker.eventCount++}_start`;
    this._startTime = performanceNow();
    this._values = values;
    if (canMeasure) {
      // eslint-disable-next-line no-undef
      performance.mark(this._startMark);
    }
  }

  onError(error: Error): void {
    this._trackTimingEvent(error);
  }

  onCancel(): void {
    this._trackTimingEvent(/* error */ null, true);
  }

  onSuccess(): void {
    this._trackTimingEvent(/* error */ null);
  }

  _trackTimingEvent(exception: ?Error, canceled: boolean = false): void {
    if (canMeasure) {
      /* eslint-disable no-undef */
      // call measure to add this information to the devtools timeline in the
      // case the profiler is running.
      performance.measure(this._eventName, this._startMark);
      // then clear all the marks and measurements to avoid growing the
      // performance entry buffer
      performance.clearMarks(this._startMark);
      performance.clearMeasures(this._eventName);
      /* eslint-enable no-undef */
    }

    track(PERFORMANCE_EVENT, {
      ...this._values,
      duration: Math.round(performanceNow() - this._startTime).toString(),
      eventName: this._eventName,
      error: exception ? '1' : '0',
      exception: exception ? exception.toString() : '',
      canceled,
    });
  }
}

export function startTracking(
  eventName: string,
  values?: {[key: string]: any} = {},
): TimingTracker {
  return new TimingTracker(eventName, values);
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
export function trackTiming<T>(
  eventName: string,
  operation: () => T,
  values?: {[key: string]: any} = {},
): T {
  const tracker = startTracking(eventName, values);

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

export function decorateTrackTiming<U: Array<*>, T>(
  fn: (...args: U) => T,
  values?: {[key: string]: any} = {},
): (...args: U) => T {
  const name = getDisplayName(fn);
  function decoratedTrackTiming(...args: U) {
    return trackTiming(name, fn.bind(this, ...args), values);
  }
  decoratedTrackTiming.displayName = `trackTiming(${name})`;
  return decoratedTrackTiming;
}

/**
 * A sampled version of trackTiming that only tracks every 1/sampleRate calls.
 */
export function trackTimingSampled<T>(
  eventName: string,
  operation: () => T,
  sampleRate: number,
  values?: {[key: string]: any} = {},
): T {
  if (Math.random() * sampleRate <= 1) {
    return trackTiming(eventName, operation, {
      ...values,
      sample_rate: sampleRate,
    });
  }
  return operation();
}

export function decorateTrackTimingSampled<U: Array<*>, T>(
  fn: (...args: U) => T,
  sampleRate: number,
  values?: {[key: string]: any} = {},
): (...args: U) => T {
  const name = getDisplayName(fn);
  function decoratedTrackTimingSampled(...args: U) {
    return trackTimingSampled(name, fn.bind(this, ...args), sampleRate, values);
  }
  decoratedTrackTimingSampled.displayName = `trackTimingSampled(${name})`;
  return decoratedTrackTimingSampled;
}

export function setRawAnalyticsService(
  analyticsService: RawAnalyticsService,
  ob: Observable<SessionInfo>,
): void {
  analyticsService.setApplicationSessionObservable(ob);
  rawAnalyticsService = analyticsService;
}

export default {
  track,
  trackSampled,
  trackEvent,
  trackTiming,
  trackTimingSampled,
  startTracking,
  TimingTracker,
  decorateTrackTiming,
  decorateTrackTimingSampled,
};
