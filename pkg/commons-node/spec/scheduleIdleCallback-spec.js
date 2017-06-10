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

describe('scheduleIdleCallback using node API', () => {
  let oldSetImmediate;
  let oldClearImmediate;
  let setImmediateCalls;
  let clearImmediateCalls;
  let scheduleIdleCallback;
  let oldRequestIdleCallback;

  beforeEach(() => {
    oldRequestIdleCallback = global.requestIdleCallback;
    delete global.requestIdleCallback;

    oldSetImmediate = global.setImmediate;
    setImmediateCalls = [];
    global.setImmediate = (...args) => {
      setImmediateCalls.push(args);
      return 1;
    };

    oldClearImmediate = global.clearImmediate;
    clearImmediateCalls = [];
    global.clearImmediate = (...args) => {
      clearImmediateCalls.push(args);
    };

    delete require.cache[require.resolve('../scheduleIdleCallback')];
    scheduleIdleCallback = require('../scheduleIdleCallback').default;
  });

  afterEach(() => {
    global.clearImmediate = oldClearImmediate;
    global.setImmediate = oldSetImmediate;
    global.requestIdleCallback = oldRequestIdleCallback;
    delete require.cache[require.resolve('../scheduleIdleCallback')];
  });

  it('works', () => {
    const fnCalls = [];
    const fn = () => {
      fnCalls.push([]);
    };
    const disposable = scheduleIdleCallback(fn);
    expect(setImmediateCalls.length).toBe(1);
    expect(setImmediateCalls[0][0]).toBe(fn);
    expect(clearImmediateCalls.length).toBe(0);

    disposable.dispose();
    expect(clearImmediateCalls.length).toBe(1);
  });
});

describe('scheduleIdleCallback using browser API', () => {
  let oldRequestIdleCallback;
  let oldCancelIdleCallback;
  let requestIdleCallbackCalls;
  let cancelIdleCallbackCalls;
  let scheduleIdleCallback;

  beforeEach(() => {
    oldRequestIdleCallback = global.requestIdleCallback;
    requestIdleCallbackCalls = [];
    let count = 1;
    global.requestIdleCallback = (...args) => {
      requestIdleCallbackCalls.push(args);
      return count++;
    };

    oldCancelIdleCallback = global.cancelIdleCallback;
    cancelIdleCallbackCalls = [];
    global.cancelIdleCallback = (...args) => {
      cancelIdleCallbackCalls.push(args);
    };

    delete require.cache[require.resolve('../scheduleIdleCallback')];
    scheduleIdleCallback = require('../scheduleIdleCallback').default;
  });

  afterEach(() => {
    global.cancelIdleCallback = oldCancelIdleCallback;
    global.requestIdleCallback = oldRequestIdleCallback;
    delete require.cache[require.resolve('../scheduleIdleCallback')];
  });

  it('works', () => {
    const fnCalls = [];
    const fn = () => {
      fnCalls.push([]);
    };
    const disposable = scheduleIdleCallback(fn);
    expect(requestIdleCallbackCalls.length).toBe(1);
    requestIdleCallbackCalls[0][0]({timeRemaining: () => 48});
    expect(fnCalls.length).toBe(0);
    expect(requestIdleCallbackCalls.length).toBe(2);
    requestIdleCallbackCalls[1][0]({timeRemaining: () => 49});
    expect(fnCalls.length).toBe(1);
    expect(cancelIdleCallbackCalls.length).toBe(0);

    disposable.dispose();
    expect(cancelIdleCallbackCalls.length).toBe(0);
  });

  it('cancels', () => {
    const disposable = scheduleIdleCallback(() => {});
    requestIdleCallbackCalls[0][0]({timeRemaining: () => 48});
    disposable.dispose();
    expect(cancelIdleCallbackCalls.length).toBe(1);
    disposable.dispose();
    expect(cancelIdleCallbackCalls.length).toBe(1);
  });

  it('expires after a timeout', () => {
    let curDate = 0;
    jasmine.unspy(Date, 'now');
    spyOn(Date, 'now').andCallFake(() => curDate);
    const fn = jasmine.createSpy('callback');
    const disposable = scheduleIdleCallback(fn, {
      afterRemainingTime: 100,
      timeout: 100,
    });

    requestIdleCallbackCalls[0][0]({timeRemaining: () => 48});
    expect(fn).not.toHaveBeenCalled();
    curDate = 50;
    requestIdleCallbackCalls[0][0]({timeRemaining: () => 48});
    expect(fn).not.toHaveBeenCalled();
    curDate = 100;
    requestIdleCallbackCalls[0][0]({timeRemaining: () => 48});
    expect(fn).toHaveBeenCalled();

    disposable.dispose();
    expect(cancelIdleCallbackCalls.length).toBe(0);
  });
});
