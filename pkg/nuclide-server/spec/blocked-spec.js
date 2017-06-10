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

import blocked from '../lib/blocked';

let now = 0;

describe('blocked()', () => {
  let blockHandler;
  let intervalHandler;

  beforeEach(() => {
    jasmine.useRealClock();
    blockHandler = jasmine.createSpy();
    jasmine.Clock.useMock();
    spyOn(Date, 'now').andCallFake(() => now);

    intervalHandler = blocked(blockHandler, 100, 10);
  });

  afterEach(() => {
    clearInterval(intervalHandler);
  });

  it('reports blocking events over the threshold', () => {
    now = 150;
    jasmine.Clock.tick(150);

    expect(blockHandler.callCount).toBe(1);
    expect(blockHandler.argsForCall[0][0]).toBe(50);
  });
});
