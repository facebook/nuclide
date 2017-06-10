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

import invariant from 'assert';
import EventEmitter from 'events';
import {attachEvent, observableFromSubscribeFunction} from '../event';

describe('attachEvent', () => {
  describe('the returned disposable', () => {
    it("doesn't remove other listeners when disposed multiple times", () => {
      const foo = jasmine.createSpy('foo');
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
    spyOn(disposable, 'dispose').andCallThrough();
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

  it('should send events to the observable stream', () => {
    waitsForPromise(async () => {
      const result = observableFromSubscribeFunction(subscribeFunction)
        .take(2)
        .toArray()
        .toPromise();
      invariant(callback != null);
      callback(1);
      callback(2);
      expect(await result).toEqual([1, 2]);
    });
  });

  it('should properly unsubscribe and resubscribe', () => {
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
});
