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

export function trackTiming<T>(
  eventName: string,
  operation: () => T,
  values?: {[key: string]: any} = {},
): T {
  return operation();
}

export const track: any = jest.fn();

export const startTracking = () => {
  const timingTracker: any = {
    onError: jest.fn(),
    onSuccess: jest.fn(),
  };

  return timingTracker;
};

export const trackImmediate: any = jest.fn();

export const setRawAnalyticsService: any = jest.fn();

export const trackTimingSampled: any = jest.fn((event, fn) => fn());
export const decorateTrackTiming: any = jest.fn(fn => (...args) => fn(...args));
export const decorateTrackTimingSampled: any = jest.fn(fn => (...args) =>
  fn(...args),
);

export const trackSampled: any = jest.fn();
