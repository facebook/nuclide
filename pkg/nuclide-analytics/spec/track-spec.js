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

import {startTracking, trackImmediate} from '..';
import * as track from '../lib/track';
import invariant from 'assert';

describe('startTracking', () => {
  let trackKey;
  let trackValues;
  let startTime;

  beforeEach(() => {
    spyOn(process, 'hrtime').andCallFake(() => {
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

    spyOn(track, 'track').andCallFake((key, values) => {
      trackKey = key;
      trackValues = values;
      return Promise.resolve();
    });
  });

  it('startTracking - success', () => {
    const timer = startTracking('st-success');
    advanceClock(10);
    timer.onSuccess();
    expect(track.track).toHaveBeenCalled();
    expect(trackKey).toBe('performance');
    invariant(trackValues != null);
    expect(trackValues.duration).toBe('10');
    expect(trackValues.eventName).toBe('st-success');
    expect(trackValues.error).toBe('0');
    expect(trackValues.exception).toBe('');
  });

  it('startTracking - error', () => {
    const timer = startTracking('st-error');
    advanceClock(11);
    timer.onError(new Error());
    expect(track.track).toHaveBeenCalled();
    expect(trackKey).toBe('performance');
    invariant(trackValues != null);
    expect(trackValues.duration).toBe('11');
    expect(trackValues.eventName).toBe('st-error');
    expect(trackValues.error).toBe('1');
    expect(trackValues.exception).toBe('Error');
  });
});

describe('trackImmediate', () => {
  let spy;
  beforeEach(() => {
    spy = spyOn(track, 'track').andCallFake((key, values) => {
      return Promise.resolve(1);
    });
  });

  it('should call track with immediate = true', () => {
    waitsForPromise(async () => {
      const result = await trackImmediate('test', {});
      expect(result).toBe(1);
      expect(spy).toHaveBeenCalledWith('test', {}, true);
    });
  });
});
