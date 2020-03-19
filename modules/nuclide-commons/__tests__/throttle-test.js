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
import {throttle} from '../observable.js';
import {Subject, Observable} from 'rxjs';
import {sleep} from '../promise';

describe('throttle', () => {
  it('handles basic test', () => {
    const source = new Subject();
    const delay = new Subject();
    const throttled = source.pipe(throttle(() => delay));
    const values = [];
    throttled.subscribe(x => {
      values.push(x);
    });

    // Make sure we emit the leading elements.
    source.next(1);
    expect(values).toEqual([1]);

    // Make sure we ignore elements during the cooldown.
    source.next(2);
    source.next(3);
    expect(values).toEqual([1]);

    // Make sure we emit the trailing elements.
    delay.next();
    expect(values).toEqual([1, 3]);

    // Make sure we don't re-emit values when no new ones come in.
    delay.next();
    delay.next();
    expect(values).toEqual([1, 3]);
  });

  it('emits trailing values when the source is a synchronously emitting cold observable', async () => {
    const source = Observable.of(1, 2, 3, 4).concat(Observable.never());
    const delay = new Subject();
    const throttled = source.pipe(throttle(() => delay));
    const values = [];
    throttled.subscribe(x => {
      values.push(x);
    });

    // Make sure we emit the leading elements.
    expect(values).toEqual([1]);

    // Make sure we emit the trailing elements.
    delay.next();
    expect(values).toEqual([1, 4]);
  });

  it('handles numeric delay', async () => {
    const source = new Subject();
    const delay = 100;
    const throttled = source.pipe(throttle(delay));
    const values = [];
    let lastTiming = null;
    throttled.subscribe(x => {
      values.push(x);
      const currentTime = Date.now();
      if (lastTiming != null) {
        expect(currentTime - lastTiming).toBeGreaterThanOrEqual(delay);
      }
      lastTiming = currentTime;
    });

    source.next('A');
    await sleep(70);
    source.next('B');
    await sleep(50);
    source.next('C');
    await sleep(110);
    source.next('D');
    await sleep(30);
    source.next('E');
    await sleep(200);
    source.next('F');
    source.complete();

    await sleep(delay);
    expect(values).toEqual(['A', 'B', 'C', 'E', 'F']);
  });

  it('calls delay based on emitted value', async () => {
    const delayInput = 1500;
    const source = new Observable.of(delayInput, delayInput);
    function delay(val: number) {
      return Observable.timer(val);
    }

    const throttled = source.pipe(throttle(delay));
    let lastTiming = null;
    const intervalThreshold = 20;
    throttled.subscribe(x => {
      const currentTime = Date.now();
      if (lastTiming != null) {
        expect(Math.abs(currentTime - lastTiming - delayInput)).toBeGreaterThan(
          intervalThreshold,
        );
      }
      lastTiming = currentTime;
    });
  });

  it('emits the leading item immeditately by default', () => {
    const source = Observable.of(1, 2).merge(Observable.never());
    const spy = jest.fn();
    source.pipe(throttle(() => Observable.never())).subscribe(spy);
    expect(spy).toHaveBeenCalledWith(1);
  });

  it("doesn't emit the leading item twice", () => {
    const source = Observable.of(1).merge(Observable.never());
    const notifier = Observable.of(null); // emits immediately on subscription.
    const spy = jest.fn();
    source.pipe(throttle(() => notifier)).subscribe(spy);
    expect(spy.mock.calls.length).toBe(1);
  });

  it('subscribes to the source once per subscription', () => {
    const spy = jest.fn();
    const source = Observable.create(spy);
    source.pipe(throttle(() => Observable.of(null))).subscribe();
    expect(spy.mock.calls.length).toBe(1);
  });

  it('supports promises', () => {
    const source = Observable.of(1, 2);
    const spy = jest.fn();
    const notifier = new Promise((resolve, reject) => {
      resolve('done');
    });
    source.pipe(throttle(notifier)).subscribe(spy);
    expect(spy.mock.calls.length).toBe(1);
  });

  function makeThrottle(options) {
    const timer = new Subject();
    const source = new Subject();
    const throttled = source.let(throttle(timer, options));

    const emitted = [];
    const subscription = throttled.subscribe(value => emitted.push(value));

    return {
      timer,
      source,
      emitted,
      dispose: () => subscription.unsubscribe(),
    };
  }

  test('emits the leading value by default', () => {
    const {source, timer, emitted, dispose} = makeThrottle();
    source.next(1);
    expect(emitted).toEqual([1]);
    timer.next(null);
    expect(emitted).toEqual([1]);
    source.next(2);
    source.next(3);
    source.next(4);
    expect(emitted).toEqual([1, 2]);
    timer.next(null);
    expect(emitted).toEqual([1, 2, 4]);
    dispose();
  });

  test('defaults to leading when `leading` is omitted in options', () => {
    const {source, emitted, dispose} = makeThrottle({});
    source.next(1);
    expect(emitted).toEqual([1]);
    dispose();
  });

  test('does not emit on completion', () => {
    const {source, emitted, dispose} = makeThrottle();
    source.next(1);
    expect(emitted).toEqual([1]);
    source.next(2);
    source.complete();
    expect(emitted).toEqual([1]);
    dispose();
  });

  test('does not emit the leading value, when leading: false', () => {
    const {source, timer, emitted, dispose} = makeThrottle({
      leading: false,
    });
    source.next(1);
    expect(emitted).toEqual([]);
    timer.next(null);
    expect(emitted).toEqual([1]);
    source.next(2);
    source.next(3);
    source.next(4);
    expect(emitted).toEqual([1]);
    timer.next(null);
    expect(emitted).toEqual([1, 4]);
    dispose();
  });
});
