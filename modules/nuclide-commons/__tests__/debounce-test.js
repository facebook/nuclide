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
import invariant from 'assert';
import debounce from '../debounce';

const sleep = n => new Promise(resolve => setTimeout(resolve, n));

describe('debounce()', () => {
  it('only calls function once after time advances', async () => {
    jest.useRealTimers();
    const timerCallback: any = jest.fn();
    const debouncedFunc = debounce(timerCallback, 10, false);

    debouncedFunc();
    expect(timerCallback).not.toHaveBeenCalled();

    await sleep(50);
    expect(timerCallback).toHaveBeenCalled();
  });

  it('disposes', () => {
    jest.useFakeTimers();
    const timerCallback: any = jest.fn();
    const debouncedFunc = debounce(timerCallback, 100, false);

    debouncedFunc();
    expect(timerCallback).not.toHaveBeenCalled();

    debouncedFunc.dispose();

    jest.advanceTimersByTime(101);
    expect(timerCallback).not.toHaveBeenCalled();
  });

  it('does not swallow flow types', () => {
    jest.useFakeTimers();
    const func = (a: string): number => 1;
    const debounced = debounce(func, 0);
    const ret = debounced('bar');

    // $FlowIgnore: func's first param should be a string.
    debounced(1);

    expect(() => {
      // $FlowIgnore: debounce's return type is "maybe func's return" type.
      (ret: number);
      // This is false because we haven't waited for the timer.
      invariant(ret != null);
      (ret: number);
    }).toThrow();

    debounced.dispose();

    expect(() => {
      // $FlowIgnore: debounced has no "bar" property.
      debounced.bar();
    }).toThrow();
  });
});
