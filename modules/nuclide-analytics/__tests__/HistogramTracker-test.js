/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import {HistogramTracker} from '../lib/HistogramTracker';

describe('HistogramTracker', () => {
  let trackSpy;
  let tracker;
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.useFakeTimers();
    const trackModule = require('../lib/track');
    trackSpy = jest.spyOn(trackModule, 'track');
    tracker = new HistogramTracker('test', 100, 10, 5);
  });

  afterEach(() => {
    tracker.dispose();
  });

  it('can track some values', () => {
    tracker.track(2);
    tracker.track(3);
    tracker.track(7);
    tracker.track(9);
    expect(tracker._buckets.length).toBe(10);
    expect(tracker._buckets[0].getCount()).toBe(4);
    expect(tracker._buckets[0].getAverage()).toBe(5.25);

    tracker.track(10);
    tracker.track(10.5);
    tracker.track(15.5);
    expect(tracker._buckets[1].getCount()).toBe(3);
    expect(tracker._buckets[1].getAverage()).toBe(12);
  });

  it('can save analytics', () => {
    tracker.track(2);
    tracker.track(15);
    tracker.track(42);
    tracker.saveAnalytics();

    expect(trackSpy.mock.calls.map(x => x)).toEqual([
      ['performance-histogram', {average: 2, samples: 1, eventName: 'test'}],
      ['performance-histogram', {average: 15, samples: 1, eventName: 'test'}],
      ['performance-histogram', {average: 42, samples: 1, eventName: 'test'}],
    ]);
  });

  it('can be cleared', () => {
    tracker.track(2);
    tracker.clear();
    tracker.saveAnalytics();
    expect(trackSpy.mock.calls.length).toBe(0);
  });

  it('can save analytics at an interval', () => {
    tracker.track(2);
    jest.advanceTimersByTime(5 * 1000);
    expect(trackSpy.mock.calls.length).toBe(1);
    expect(trackSpy.mock.calls[0]).toEqual([
      'performance-histogram',
      {average: 2, samples: 1, eventName: 'test'},
    ]);

    tracker.track(42);
    jest.advanceTimersByTime(5 * 1000);
    expect(trackSpy.mock.calls.length).toBe(2);
    expect(trackSpy.mock.calls[1]).toEqual([
      'performance-histogram',
      {average: 42, samples: 1, eventName: 'test'},
    ]);
  });
});

describe('Histogram.dispose', () => {
  it('stops after dispose', () => {
    jest.restoreAllMocks();
    const trackModule = require('../lib/track');
    const trackSpy = jest.spyOn(trackModule, 'track');
    const tracker = new HistogramTracker('test', 100, 10, 5);
    tracker.track(1);
    tracker.dispose();
    jest.advanceTimersByTime(5 * 1000);
    expect(trackSpy.mock.calls.length).toBe(0);
  });
});
