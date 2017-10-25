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

describe('Fake timer test suite', () => {
  it('test setTimeout and clearTimeout', () => {
    let firstExecuted = false;

    setTimeout(() => {
      firstExecuted = true;
    }, 10);

    advanceClock(9);

    expect(firstExecuted).toBe(false);
    advanceClock(1);
    expect(firstExecuted).toBe(true);

    let secondExecuted = false;
    let thirdExecuted = false;

    const secondId = setTimeout(() => {
      secondExecuted = true;
    }, 20);
    setTimeout(() => {
      thirdExecuted = true;
    }, 30);

    advanceClock(19);
    clearTimeout(secondId);

    expect(secondExecuted).toBe(false);
    expect(thirdExecuted).toBe(false);

    advanceClock(20);

    expect(secondExecuted).toBe(false);
    expect(thirdExecuted).toBe(true);
  });

  it('test setInterval and clearInterval', () => {
    jasmine.useMockClock();

    let firstExecuted = false;

    setInterval(() => {
      firstExecuted = true;
    }, 10);

    advanceClock(9);

    expect(firstExecuted).toBe(false);
    advanceClock(1);
    expect(firstExecuted).toBe(true);

    let secondExecuted = false;
    let thirdExecuted = false;

    const secondId = setInterval(() => {
      secondExecuted = true;
    }, 20);
    setInterval(() => {
      thirdExecuted = true;
    }, 30);

    advanceClock(19);
    clearInterval(secondId);

    expect(secondExecuted).toBe(false);
    expect(thirdExecuted).toBe(false);

    advanceClock(20);

    expect(secondExecuted).toBe(false);
    expect(thirdExecuted).toBe(true);
  });

  it('test fakeSetTimeout triggered in expected order', () => {
    let firstExecuted = false;
    let secondExecuted = false;

    setTimeout(() => {
      firstExecuted = true;
      expect(secondExecuted).toBe(false);
    }, 10);

    setTimeout(() => {
      secondExecuted = true;
      expect(firstExecuted).toBe(true);
    }, 20);

    advanceClock(20);

    expect(firstExecuted).toBe(true);
    expect(secondExecuted).toBe(true);
  });

  it('test fakeSetInterval and fakeClearInterval', () => {
    let firstExecutedCount = 0;
    let secondExecutedCount = 0;

    global.fakeSetInterval(() => firstExecutedCount++, 10);
    advanceClock(5);
    const secondId = global.fakeSetInterval(() => secondExecutedCount++, 10);

    advanceClock(15);

    expect(firstExecutedCount).toBe(2);
    expect(secondExecutedCount).toBe(1);

    global.fakeClearInterval(secondId);

    advanceClock(20);

    expect(firstExecutedCount).toBe(4);
    expect(secondExecutedCount).toBe(1);
  });

  // Atom's implementation will fail at this test case. (https://github.com/atom/atom/issues/6627)
  it('test fakeSetInterval triggered in expected order', () => {
    let firstExecutedCount = 0;
    let secondExecutedCount = 0;

    global.fakeSetInterval(() => {
      firstExecutedCount++;
      expect(secondExecutedCount < firstExecutedCount).toBe(true);
    }, 10);

    advanceClock(5);

    global.fakeSetInterval(() => secondExecutedCount++, 10);

    advanceClock(40);

    expect(firstExecutedCount).toBe(4);
    expect(secondExecutedCount).toBe(4);
  });

  it('test Date.now and global.now', () => {
    const now1 = Date.now();
    expect(now1).toEqual(global.now);
    advanceClock(100);
    const now2 = Date.now();
    expect(now2 - now1).toEqual(100);
    expect(now2).toEqual(global.now);
  });
});
