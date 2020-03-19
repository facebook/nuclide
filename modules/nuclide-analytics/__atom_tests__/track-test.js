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
 * @emails oncall+nuclide
 */
jest.unmock('nuclide-commons/analytics');
jest.mock('../lib/track', () => {
  return {
    track: jest.fn(() => Promise.resolve(1)),
    setApplicationSessionObservable: () => {},
  };
});

import {
  setRawAnalyticsService,
  startTracking,
  trackImmediate,
} from 'nuclide-commons/analytics';
import service from '../lib/track';
import invariant from 'assert';
import {Observable} from 'rxjs';

const sleep = n => new Promise(r => setTimeout(r, n));

beforeEach(() => {
  jest.restoreAllMocks();
  setRawAnalyticsService(service, Observable.from([]));
});

describe('startTracking', () => {
  let trackKey;
  let trackValues;
  let startTime;

  beforeEach(() => {
    jest.spyOn(process, 'hrtime').mockImplementation(() => {
      if (startTime == null) {
        startTime = Date.now();
      }
      const milliseconds = Date.now() - startTime;
      const seconds = Math.floor(milliseconds / 1000);
      const nanoseconds = (milliseconds - seconds * 1000) * 1000000;
      return [seconds, nanoseconds];
    });

    // Clear intercepted tracking data.
    trackKey = null;
    trackValues = null;

    // $FlowFixMe
    service.track.mockImplementation((key, values) => {
      trackKey = key;
      trackValues = values;
      return Promise.resolve(1);
    });
  });

  it('startTracking - success', async () => {
    const timer = startTracking('st-success');
    await sleep(10);
    timer.onSuccess();
    expect(service.track).toHaveBeenCalled();
    expect(trackKey).toBe('performance');
    invariant(trackValues != null);
    expect(Number(trackValues.duration)).toBeGreaterThanOrEqual(10);
    expect(trackValues.eventName).toBe('st-success');
    expect(trackValues.error).toBe('0');
    expect(trackValues.exception).toBe('');
  });

  it('startTracking - success with values', async () => {
    const timer = startTracking('st-success', {newValue: 'value'});
    await sleep(10);
    timer.onSuccess();
    expect(service.track).toHaveBeenCalled();
    expect(trackKey).toBe('performance');
    invariant(trackValues != null);
    expect(Number(trackValues.duration)).toBeGreaterThanOrEqual(10);
    expect(trackValues.eventName).toBe('st-success');
    expect(trackValues.error).toBe('0');
    expect(trackValues.exception).toBe('');
    expect(trackValues.newValue).toBe('value');
  });

  it('startTracking - error', async () => {
    const timer = startTracking('st-error');
    await sleep(11);
    timer.onError(new Error());
    expect(service.track).toHaveBeenCalled();
    expect(trackKey).toBe('performance');
    invariant(trackValues != null);
    expect(Number(trackValues.duration)).toBeGreaterThanOrEqual(11);
    expect(trackValues.eventName).toBe('st-error');
    expect(trackValues.error).toBe('1');
    expect(trackValues.exception).toBe('Error');
  });

  it('startTracking - error with values', async () => {
    const timer = startTracking('st-error', {newValue: 'value'});
    await sleep(11);
    timer.onError(new Error());
    expect(service.track).toHaveBeenCalled();
    expect(trackKey).toBe('performance');
    invariant(trackValues != null);
    expect(Number(trackValues.duration)).toBeGreaterThanOrEqual(11);
    expect(trackValues.eventName).toBe('st-error');
    expect(trackValues.error).toBe('1');
    expect(trackValues.exception).toBe('Error');
    expect(trackValues.newValue).toBe('value');
  });
});

describe('trackImmediate', () => {
  it('calls track with immediate = true', async () => {
    const result = await trackImmediate('test', {});
    expect(result).toBe(1);
    expect(service.track).toHaveBeenCalledWith('test', {}, true);
  });
});
