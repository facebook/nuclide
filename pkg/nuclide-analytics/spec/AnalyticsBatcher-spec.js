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

import {AnalyticsBatcher} from '../lib/AnalyticsBatcher';

describe('analytics - AnalyticsBatcher', () => {
  it('batching track calls', () => {
    const track = jasmine.createSpy('track');
    const batcher = new AnalyticsBatcher(track);

    batcher.track('key1', {});
    batcher.track('key2', {v1: 'value1'});
    expect(track).not.toHaveBeenCalled();

    advanceClock(999);
    expect(track).not.toHaveBeenCalled();
    advanceClock(1);
    expect(track).toHaveBeenCalledWith([
      {key: 'key1', values: {}},
      {key: 'key2', values: {v1: 'value1'}},
    ]);

    batcher.track('key3', {});
    advanceClock(10000);
    expect(track).toHaveBeenCalledWith([{key: 'key3', values: {}}]);
  });

  it('flush on dispose', () => {
    const track = jasmine.createSpy('track');
    const batcher = new AnalyticsBatcher(track);

    batcher.track('key1', {});
    batcher.track('key2', {v1: 'value1'});
    expect(track).not.toHaveBeenCalled();

    batcher.dispose();
    expect(track).toHaveBeenCalledWith([
      {key: 'key1', values: {}},
      {key: 'key2', values: {v1: 'value1'}},
    ]);
  });
});
