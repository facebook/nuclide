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

import invariant from 'assert';
import {Observable} from 'rxjs';

import {_DOMObserverObservable as DOMObserverObservable} from '../observable-dom';

describe('new DOMObserverObservable', () => {
  let observerInstance;

  beforeEach(() => {
    observerInstance = null;
  });

  class MockDOMObserver {
    _args: Array<any>;
    _callback: Function;
    _connected: boolean;

    constructor(callback) {
      this._callback = callback;
      observerInstance = this;
    }
    observe(...args: any[]) {
      this._args = args;
      this._connected = true;
    }
    disconnect() {
      this._connected = false;
    }
  }

  it('does not construct a DOM Observer until the Rx Observable is subscribed to', () => {
    // $FlowFixMe(>=0.55.0) Flow suppress
    const o = new DOMObserverObservable(MockDOMObserver, 'some', 'additional', {
      args: true,
    });
    expect(observerInstance).toBe(null);

    const subscription = o.subscribe(() => {});
    invariant(observerInstance != null);
    expect(observerInstance._args).toEqual([
      'some',
      'additional',
      {args: true},
    ]);
    expect(observerInstance._connected).toBe(true);
    subscription.unsubscribe();
  });

  it('calls disconnect on the underlying DOM Observer when unsubscribe is called', () => {
    // $FlowFixMe(>=0.55.0) Flow suppress
    const o = new DOMObserverObservable(MockDOMObserver, 'some', 'additional', {
      args: true,
    });
    const subscription = o.subscribe(() => {});

    invariant(observerInstance != null);
    expect(observerInstance._connected).toBe(true);

    subscription.unsubscribe();
    expect(observerInstance._connected).toBe(false);
  });

  it(
    'by default (without a call to .flattenEntries()) creates an observable of ' +
      'the elements emitted from the DOM Observer',
    () => {
      class MockDOMObserverEmitsArray extends MockDOMObserver {
        observe(...args: Array<any>) {
          super.observe(...args);
          Observable.interval(1)
            .mapTo(['foo', 'bar', 'baz'])
            .take(2)
            .subscribe(this._callback);
        }
      }

      waitsForPromise(async () => {
        // $FlowFixMe(>=0.55.0) Flow suppress
        const output = await new DOMObserverObservable(
          MockDOMObserverEmitsArray,
          'arg',
        )
          .take(2)
          .toArray()
          .toPromise();
        expect(output).toEqual([['foo', 'bar', 'baz'], ['foo', 'bar', 'baz']]);
      });
    },
  );

  describe('multiple subscribers', () => {
    it('only disconnects the underlying observer when all subscribers have unsubscribed', () => {
      // $FlowFixMe(>=0.55.0) Flow suppress
      const o = new DOMObserverObservable(
        MockDOMObserver,
        'some',
        'additional',
        {
          args: true,
        },
      );
      const subscription = o.subscribe(() => {});
      const subscription2 = o.subscribe(() => {});

      invariant(observerInstance != null);
      expect(observerInstance._connected).toBe(true);

      subscription.unsubscribe();
      // the underlying observer is still connected when only one of the two
      // subscribers unsubscribes
      expect(observerInstance._connected).toBe(true);

      expect(() => {
        subscription2.unsubscribe();
      }).not.toThrow();
      // and finally disconnect when all subscribers have unsubscribed
      expect(observerInstance._connected).toBe(false);
    });

    it(
      'creates a new underlying observable and connects it for new' +
        'subscriptions that happen after a disconnect',
      () => {
        // $FlowFixMe(>=0.55.0) Flow suppress
        const o = new DOMObserverObservable(
          MockDOMObserver,
          'some',
          'additional',
          {
            args: true,
          },
        );
        const subscription = o.subscribe(() => {});
        const subscription2 = o.subscribe(() => {});

        invariant(observerInstance != null);
        const oldObserver = observerInstance;

        subscription.unsubscribe();
        subscription2.unsubscribe();

        expect(observerInstance._connected).toBe(false);
        const newSubscription = o.subscribe(() => {});
        // creates a new underlying observer
        expect(observerInstance).not.toBe(oldObserver);
        expect(observerInstance._connected).toBe(true);
        newSubscription.unsubscribe();
      },
    );
  });

  describe('flattenEntries operator', () => {
    it('implements lift to cause subsequent operators to return DOMObserverObservables', () => {
      class MockDOMObserverEmitsArray extends MockDOMObserver {
        observe(...args: Array<any>) {
          super.observe(...args);
          Observable.interval(1)
            .mapTo(['foo', 'bar', 'baz'])
            .take(2)
            .subscribe(this._callback);
        }
      }

      expect(
        // $FlowFixMe(>=0.55.0) Flow suppress
        new DOMObserverObservable(MockDOMObserverEmitsArray, 'arg')
          .flattenEntries()
          .map(x => x) instanceof DOMObserverObservable,
      ).toBe(true);
    });

    it('creates an observable of the individual elements of the array emitted from the DOM Observer', () => {
      class MockDOMObserverEmitsArray extends MockDOMObserver {
        observe(...args: Array<any>) {
          super.observe(...args);
          Observable.interval(1)
            .mapTo(['foo', 'bar', 'baz'])
            .take(2)
            .subscribe(this._callback);
        }
      }

      waitsForPromise(async () => {
        // $FlowFixMe(>=0.55.0) Flow suppress
        const output = await new DOMObserverObservable(
          MockDOMObserverEmitsArray,
          'arg',
        )
          .flattenEntries()
          .take(6)
          .toArray()
          .toPromise();
        expect(output).toEqual(['foo', 'bar', 'baz', 'foo', 'bar', 'baz']);
      });
    });

    it(
      'creates an observable of the individual elements of the array returned ' +
        'from the getEntries method of the entrylist emitted from the DOM Observer',
      () => {
        class MockDOMObserverEmitsEntryList extends MockDOMObserver {
          observe(...args: Array<any>) {
            super.observe(...args);
            Observable.interval(1)
              .mapTo({
                getEntries: () => ['foo', 'bar', 'baz'],
              })
              .take(2)
              .subscribe(this._callback);
          }
        }

        waitsForPromise(async () => {
          // $FlowFixMe(>=0.55.0) Flow suppress
          const output = await new DOMObserverObservable(
            MockDOMObserverEmitsEntryList,
            'arg',
          )
            .flattenEntries()
            .take(6)
            .toArray()
            .toPromise();
          expect(output).toEqual(['foo', 'bar', 'baz', 'foo', 'bar', 'baz']);
        });
      },
    );

    it('throws if neither an iterable nor an EntryList is emitted from the DOM Observer', () => {
      class MockDOMObserverEmitsNonStandard extends MockDOMObserver {
        observe(...args: Array<any>) {
          super.observe(...args);
          Observable.interval(1)
            .take(2)
            .subscribe(this._callback);
        }
      }

      waitsForPromise(async () => {
        let error;
        try {
          // $FlowFixMe(>=0.55.0) Flow suppress
          await new DOMObserverObservable(
            MockDOMObserverEmitsNonStandard,
            'arg',
          )
            .flattenEntries()
            .take(2)
            .toArray()
            .toPromise();
        } catch (e) {
          error = e;
        }
        invariant(error != null);
        expect(error.message).toEqual(
          'Tried to merge DOM Observer entries, but they were not iterable nor were they an EntryList.',
        );
      });
    });
  });
});
