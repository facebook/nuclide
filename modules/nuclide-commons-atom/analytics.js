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

import {Disposable} from 'atom';

class NullTimingTracker {
  constructor(name: string) {}
  onError(error: Error) {}
  onSuccess() {}
}

type TrackingEvent = {
  type: string,
  data?: Object,
};

type TimingTrackerType = {
  onError(error: Error): void,
  onSuccess(): void,
};

const NullService = {
  track(eventName: string, values?: {[key: string]: mixed}): void {},
  trackEvent(event: TrackingEvent): void {},
  trackEvents(events: Observable<TrackingEvent>): IDisposable {
    return new Disposable();
  },
  trackImmediate(
    eventName: string,
    values?: {[key: string]: mixed},
  ): Promise<mixed> {
    return Promise.resolve();
  },
  startTracking(eventName: string): TimingTrackerType {
    return new NullTimingTracker(eventName);
  },
  trackTiming<T>(eventName: string, operation: () => T): T {
    return operation();
  },
  TimingTracker: NullTimingTracker,
};

let service = NullService;
atom.packages.serviceHub.consume(
  'nuclide-analytics',
  '0.0.0',
  analyticsService => {
    // es module export is a live binding, so modifying this updates the value
    // for the consumer
    service = analyticsService;
  },
);

export default service;
