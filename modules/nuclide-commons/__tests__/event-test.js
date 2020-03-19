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
import invariant from 'assert';
import EventEmitter from 'events';
import {attachEvent, observableFromSubscribeFunction} from '../event';

describe('attachEvent', () => {
  describe('the returned disposable', () => {
    it("doesn't remove other listeners when disposed multiple times", () => {
      const foo = jest.fn();
      const emitter = new EventEmitter();
      const d1 = attachEvent(emitter, 'event', foo);
      attachEvent(emitter, 'event', foo);
      d1.dispose();
      d1.dispose();
      emitter.emit('event');
      expect(foo).toHaveBeenCalled();
    });
  });
});

describe('observableFromSubscribeFunction', () => {
  let callback: ?(item: number) => mixed;
  let disposable: ?IDisposable;

  // The subscribe function will put the given callback and the returned disposable in the variables
  // above for inspection.
  const subscribeFunction = fn => {
    callback = fn;
    disposable = {
      dispose() {
        callback = null;
      },
    };
    jest.spyOn(disposable, 'dispose');
    return disposable;
  };

  beforeEach(() => {
    callback = null;
    disposable = null;
  });

  it('should not call the subscription function until the Observable is subscribed to', () => {
    const observable = observableFromSubscribeFunction(subscribeFunction);
    expect(callback).toBeNull();
    observable.subscribe(() => {});
    expect(callback).not.toBeNull();
  });

  it('should send events to the observable stream', async () => {
    const result = observableFromSubscribeFunction(subscribeFunction)
      .take(2)
      .toArray()
      .toPromise();
    invariant(callback != null);
    callback(1);
    callback(2);
    expect(await result).toEqual([1, 2]);
  });

  it('should properly unsubscribe and resubscribe from functions that return IDisposable', () => {
    const observable = observableFromSubscribeFunction(subscribeFunction);
    let subscription = observable.subscribe(() => {});
    expect(callback).not.toBeNull();

    invariant(disposable != null);
    expect(disposable.dispose).not.toHaveBeenCalled();
    subscription.unsubscribe();
    expect(disposable.dispose).toHaveBeenCalled();

    expect(callback).toBeNull();

    subscription = observable.subscribe(() => {});

    expect(callback).not.toBeNull();

    expect(disposable.dispose).not.toHaveBeenCalled();
    subscription.unsubscribe();
    expect(disposable.dispose).toHaveBeenCalled();
  });

  it('should properly unsubscribe and resubscribe from functions that return disposal functions', () => {
    let spy;
    const returnsDisposalFunction = (cb: number => mixed) => {
      callback = cb;
      spy = jest.fn(() => (callback = null));
      return spy;
    };

    const observable = observableFromSubscribeFunction(returnsDisposalFunction);
    let subscription = observable.subscribe(() => {});
    expect(callback).not.toBeNull();

    expect(spy).not.toHaveBeenCalled();
    subscription.unsubscribe();
    expect(spy).toHaveBeenCalled();

    expect(callback).toBeNull();

    subscription = observable.subscribe(() => {});

    expect(callback).not.toBeNull();

    expect(spy).not.toHaveBeenCalled();
    subscription.unsubscribe();
    expect(spy).toHaveBeenCalled();
  });
});
