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

/**
 * Originally from https://github.com/facebook/flux/blob/55480fb/src/Dispatcher.js
 */

import Dispatcher from '../Dispatcher';

describe('Dispatcher', () => {
  let dispatcher;
  let callbackA;
  let callbackB;

  beforeEach(() => {
    dispatcher = new Dispatcher();
    callbackA = jasmine.createSpy('callbackA');
    callbackB = jasmine.createSpy('callbackB');
  });

  it('should execute all subscriber callbacks', () => {
    dispatcher.register(callbackA);
    dispatcher.register(callbackB);

    const payload = {};
    dispatcher.dispatch(payload);

    expect(callbackA.calls.length).toBe(1);
    expect(callbackA.calls[0].args[0]).toBe(payload);

    expect(callbackB.calls.length).toBe(1);
    expect(callbackB.calls[0].args[0]).toBe(payload);

    dispatcher.dispatch(payload);

    expect(callbackA.calls.length).toBe(2);
    expect(callbackA.calls[1].args[0]).toBe(payload);

    expect(callbackB.calls.length).toBe(2);
    expect(callbackB.calls[1].args[0]).toBe(payload);
  });

  it('should wait for callbacks registered earlier', () => {
    const tokenA = dispatcher.register(callbackA);

    dispatcher.register(payload => {
      dispatcher.waitFor([tokenA]);
      expect(callbackA.calls.length).toBe(1);
      expect(callbackA.calls[0].args[0]).toBe(payload);
      callbackB(payload);
    });

    const payload = {};
    dispatcher.dispatch(payload);

    expect(callbackA.calls.length).toBe(1);
    expect(callbackA.calls[0].args[0]).toBe(payload);

    expect(callbackB.calls.length).toBe(1);
    expect(callbackB.calls[0].args[0]).toBe(payload);
  });

  it('should wait for callbacks registered later', () => {
    dispatcher.register(payload => {
      dispatcher.waitFor([tokenB]);
      expect(callbackB.calls.length).toBe(1);
      expect(callbackB.calls[0].args[0]).toBe(payload);
      callbackA(payload);
    });

    const tokenB = dispatcher.register(callbackB);

    const payload = {};
    dispatcher.dispatch(payload);

    expect(callbackA.calls.length).toBe(1);
    expect(callbackA.calls[0].args[0]).toBe(payload);

    expect(callbackB.calls.length).toBe(1);
    expect(callbackB.calls[0].args[0]).toBe(payload);
  });

  it('should throw if dispatch() while dispatching', () => {
    dispatcher.register(payload => {
      dispatcher.dispatch(payload);
      callbackA();
    });

    const payload = {};
    expect(() => dispatcher.dispatch(payload)).toThrow();
    expect(callbackA.calls.length).toBe(0);
  });

  it('should throw if waitFor() while not dispatching', () => {
    const tokenA = dispatcher.register(callbackA);

    expect(() => dispatcher.waitFor([tokenA])).toThrow();
    expect(callbackA.calls.length).toBe(0);
  });

  it('should throw if waitFor() with invalid token', () => {
    const invalidToken = 1337;

    dispatcher.register(() => {
      // $FlowIgnore: Purposefully invalid token.
      dispatcher.waitFor([invalidToken]);
    });

    const payload = {};
    expect(() => dispatcher.dispatch(payload)).toThrow();
  });

  it('should throw on self-circular dependencies', () => {
    const tokenA = dispatcher.register(payload => {
      dispatcher.waitFor([tokenA]);
      callbackA(payload);
    });

    const payload = {};
    expect(() => dispatcher.dispatch(payload)).toThrow();
    expect(callbackA.calls.length).toBe(0);
  });

  it('should throw on multi-circular dependencies', () => {
    const tokenA = dispatcher.register(payload => {
      dispatcher.waitFor([tokenB]);
      callbackA(payload);
    });

    const tokenB = dispatcher.register(payload => {
      dispatcher.waitFor([tokenA]);
      callbackB(payload);
    });

    expect(() => dispatcher.dispatch({})).toThrow();
    expect(callbackA.calls.length).toBe(0);
    expect(callbackB.calls.length).toBe(0);
  });

  it('should remain in a consistent state after a failed dispatch', () => {
    dispatcher.register(callbackA);
    dispatcher.register(payload => {
      if (payload.shouldThrow) {
        throw new Error();
      }
      callbackB();
    });

    expect(() => dispatcher.dispatch({shouldThrow: true})).toThrow();

    // Cannot make assumptions about a failed dispatch.
    const callbackACount = callbackA.calls.length;

    dispatcher.dispatch({shouldThrow: false});

    expect(callbackA.calls.length).toBe(callbackACount + 1);
    expect(callbackB.calls.length).toBe(1);
  });

  it('should properly unregister callbacks', () => {
    dispatcher.register(callbackA);

    const tokenB = dispatcher.register(callbackB);

    const payload = {};
    dispatcher.dispatch(payload);

    expect(callbackA.calls.length).toBe(1);
    expect(callbackA.calls[0].args[0]).toBe(payload);

    expect(callbackB.calls.length).toBe(1);
    expect(callbackB.calls[0].args[0]).toBe(payload);

    dispatcher.unregister(tokenB);

    dispatcher.dispatch(payload);

    expect(callbackA.calls.length).toBe(2);
    expect(callbackA.calls[1].args[0]).toBe(payload);

    expect(callbackB.calls.length).toBe(1);
  });

  it('should throw if register() while dispatching', () => {
    dispatcher.register(payload => {
      dispatcher.register(callbackB);
      callbackA();
    });

    const payload = {};
    expect(() => dispatcher.dispatch(payload)).toThrow();
    expect(callbackA.calls.length).toBe(0);
  });

  it('should throw if unregister() while dispatching', () => {
    const tokenA = dispatcher.register(callbackA);
    dispatcher.register(payload => {
      dispatcher.unregister(tokenA);
      callbackB();
    });

    const payload = {};
    expect(() => dispatcher.dispatch(payload)).toThrow();
    expect(callbackA.calls.length).toBe(1);
    expect(callbackB.calls.length).toBe(0);
  });
});
