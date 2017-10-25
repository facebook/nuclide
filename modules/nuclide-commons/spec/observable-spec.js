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

import {
  bufferUntil,
  cacheWhileSubscribed,
  completingSwitchMap,
  concatLatest,
  diffSets,
  fastDebounce,
  macrotask,
  microtask,
  nextAnimationFrame,
  PromiseCancelledError,
  reconcileSetDiffs,
  SingletonExecutor,
  splitStream,
  takeWhileInclusive,
  throttle,
  toCancellablePromise,
  toggle,
} from '../observable';
import {Disposable} from 'event-kit';
import {Observable, Subject} from 'rxjs';

const setsAreEqual = (a, b) =>
  a.size === b.size && Array.from(a).every(b.has.bind(b));
const diffsAreEqual = (a, b) =>
  setsAreEqual(a.added, b.added) && setsAreEqual(a.removed, b.removed);
const createDisposable = () => {
  const disposable = new Disposable(() => {});
  spyOn(disposable, 'dispose');
  return disposable;
};

describe('nuclide-commons/observable', () => {
  describe('splitStream', () => {
    it('splits streams', () => {
      waitsForPromise(async () => {
        const input = ['foo\nbar', '\n', '\nba', 'z', '\nblar'];
        const output = await splitStream(Observable.from(input))
          .toArray()
          .toPromise();
        expect(output).toEqual(['foo\n', 'bar\n', '\n', 'baz\n', 'blar']);
      });
    });
  });

  describe('takeWhileInclusive', () => {
    it('completes the stream when something matches the predicate', () => {
      const source = new Subject();
      const result = source.let(takeWhileInclusive(x => x !== 2));
      const next: (n: number) => mixed = jasmine.createSpy();
      const complete: () => mixed = jasmine.createSpy();
      result.subscribe({next, complete});
      source.next(1);
      source.next(2);
      source.next(3);
      expect(complete).toHaveBeenCalled();
      expect(next.calls.map(call => call.args[0])).toEqual([1, 2]);
    });
  });

  describe('cacheWhileSubscribed', () => {
    let input: Subject<number> = (null: any);
    let output: Observable<number> = (null: any);

    function subscribeArray(arr: Array<number>): rxjs$ISubscription {
      return output.subscribe(x => arr.push(x));
    }
    beforeEach(() => {
      input = new Subject();
      output = cacheWhileSubscribed(input);
    });

    it('should provide cached values to late subscribers', () => {
      const arr1 = [];
      const arr2 = [];

      input.next(0);
      const sub1 = subscribeArray(arr1);
      input.next(1);
      input.next(2);
      const sub2 = subscribeArray(arr2);

      sub1.unsubscribe();
      sub2.unsubscribe();
      expect(arr1).toEqual([1, 2]);
      expect(arr2).toEqual([2]);
    });

    it('should not store stale events when everyone is unsubscribed', () => {
      const arr1 = [];
      const arr2 = [];

      input.next(0);
      const sub1 = subscribeArray(arr1);
      input.next(1);
      sub1.unsubscribe();

      input.next(2);

      const sub2 = subscribeArray(arr2);
      input.next(3);
      sub2.unsubscribe();

      expect(arr1).toEqual([1]);
      expect(arr2).toEqual([3]);
    });
  });

  describe('diffSets', () => {
    it('emits a diff for the first item', () => {
      waitsForPromise(async () => {
        const source = new Subject();
        const diffsPromise = source
          .let(diffSets())
          .toArray()
          .toPromise();
        source.next(new Set([1, 2, 3]));
        source.complete();
        const diffs = await diffsPromise;
        expect(diffs.length).toBe(1);
        expect(
          diffsAreEqual(diffs[0], {
            added: new Set([1, 2, 3]),
            removed: new Set(),
          }),
        ).toBe(true);
      });
    });

    it('correctly identifies removed items', () => {
      waitsForPromise(async () => {
        const source = new Subject();
        const diffsPromise = source
          .let(diffSets())
          .toArray()
          .toPromise();
        source.next(new Set([1, 2, 3]));
        source.next(new Set([1, 2]));
        source.complete();
        const diffs = await diffsPromise;
        expect(setsAreEqual(diffs[1].removed, new Set([3]))).toBe(true);
      });
    });

    it('correctly identifies removed items when a hash function is used', () => {
      waitsForPromise(async () => {
        const source = new Subject();
        const diffsPromise = source
          .let(diffSets(x => x.key))
          .toArray()
          .toPromise();
        const firstItems = [{key: 1}, {key: 2}, {key: 3}];
        const secondItems = [{key: 1}, {key: 2}];
        source.next(new Set(firstItems));
        source.next(new Set(secondItems));
        source.complete();
        const diffs = await diffsPromise;
        expect(setsAreEqual(diffs[1].removed, new Set([firstItems[2]]))).toBe(
          true,
        );
      });
    });

    it('correctly identifies added items', () => {
      waitsForPromise(async () => {
        const source = new Subject();
        const diffsPromise = source
          .let(diffSets())
          .toArray()
          .toPromise();
        source.next(new Set([1, 2]));
        source.next(new Set([1, 2, 3]));
        source.complete();
        const diffs = await diffsPromise;
        expect(setsAreEqual(diffs[1].added, new Set([3]))).toBe(true);
      });
    });

    it('correctly identifies added items when a hash function is used', () => {
      waitsForPromise(async () => {
        const source = new Subject();
        const diffsPromise = source
          .let(diffSets(x => x.key))
          .toArray()
          .toPromise();
        const firstItems = [{key: 1}, {key: 2}];
        const secondItems = [{key: 1}, {key: 2}, {key: 3}];
        source.next(new Set(firstItems));
        source.next(new Set(secondItems));
        source.complete();
        const diffs = await diffsPromise;
        expect(setsAreEqual(diffs[1].added, new Set([secondItems[2]]))).toBe(
          true,
        );
      });
    });

    it("doesn't emit a diff when nothing changes", () => {
      waitsForPromise(async () => {
        const source = new Subject();
        const diffsPromise = source
          .let(diffSets())
          .toArray()
          .toPromise();
        source.next(new Set([1, 2, 3]));
        source.next(new Set([1, 2, 3]));
        source.complete();
        const diffs = await diffsPromise;
        // Make sure we only get one diff (from the implicit initial empty set).
        expect(diffs.length).toBe(1);
      });
    });

    it("doesn't emit a diff when nothing changes and a hash function is used", () => {
      waitsForPromise(async () => {
        const source = new Subject();
        const diffsPromise = source
          .let(diffSets(x => x.key))
          .toArray()
          .toPromise();
        const firstItems = [{key: 1}, {key: 2}, {key: 3}];
        const secondItems = [{key: 1}, {key: 2}, {key: 3}];
        source.next(new Set(firstItems));
        source.next(new Set(secondItems));
        source.complete();
        const diffs = await diffsPromise;
        // Make sure we only get one diff (from the implicit initial empty set).
        expect(diffs.length).toBe(1);
      });
    });
  });

  describe('reconcileSetDiffs', () => {
    it("calls the add action for each item that's added", () => {
      const diffs = new Subject();
      const addAction = jasmine.createSpy().andReturn(new Disposable(() => {}));
      reconcileSetDiffs(diffs, addAction);
      diffs.next({
        added: new Set(['a', 'b']),
        removed: new Set(),
      });
      expect(addAction.calls.map(call => call.args[0])).toEqual(['a', 'b']);
    });

    it("disposes for each item that's removed", () => {
      const diffs = new Subject();
      const disposables = {
        a: createDisposable(),
        b: createDisposable(),
      };
      const addAction = item => disposables[item];
      reconcileSetDiffs(diffs, addAction);
      diffs.next({
        added: new Set(['a', 'b']),
        removed: new Set(),
      });
      diffs.next({
        added: new Set(),
        removed: new Set(['a', 'b']),
      });
      expect(disposables.a.dispose).toHaveBeenCalled();
      expect(disposables.b.dispose).toHaveBeenCalled();
    });

    it('disposes for all items when disposed', () => {
      const diffs = new Subject();
      const disposables = {
        a: createDisposable(),
        b: createDisposable(),
      };
      const addAction = item => disposables[item];
      const reconciliationDisposable = reconcileSetDiffs(diffs, addAction);
      diffs.next({
        added: new Set(['a', 'b']),
        removed: new Set(),
      });
      reconciliationDisposable.dispose();
      expect(disposables.a.dispose).toHaveBeenCalled();
      expect(disposables.b.dispose).toHaveBeenCalled();
    });

    it("disposes for each item that's removed when a hash function is used", () => {
      const diffs = new Subject();
      const disposables = {
        a: createDisposable(),
        b: createDisposable(),
      };
      const addAction = item => disposables[item.key];
      reconcileSetDiffs(diffs, addAction, x => x.key);
      diffs.next({
        added: new Set([{key: 'a'}, {key: 'b'}]),
        removed: new Set(),
      });
      diffs.next({
        added: new Set(),
        removed: new Set([{key: 'a'}, {key: 'b'}]),
      });
      expect(disposables.a.dispose).toHaveBeenCalled();
      expect(disposables.b.dispose).toHaveBeenCalled();
    });
  });

  describe('toggle', () => {
    let toggler: Subject<boolean> = (null: any);
    let source: Observable<number> = (null: any);
    let output: Observable<number> = (null: any);
    let outputArray: Array<number> = (null: any);

    beforeEach(() => {
      toggler = new Subject();
      // Deferred so individual 'it' blocks can set the source on the fly.
      output = Observable.defer(() => source).let(toggle(toggler));
    });

    describe('with a standard source', () => {
      let realSource: Subject<number> = (null: any);

      beforeEach(() => {
        source = realSource = new Subject();
        outputArray = [];
        output.subscribe(x => outputArray.push(x));
      });

      it("should not emit anything before the toggler is set to 'true'", () => {
        realSource.next(5);
        expect(outputArray).toEqual([]);
      });

      it("should start emitting events when the toggler is set to 'true'", () => {
        toggler.next(true);
        realSource.next(5);
        expect(outputArray).toEqual([5]);
      });

      it("should stop emitting events when the toggler is set to 'false'", () => {
        toggler.next(true);
        toggler.next(false);
        realSource.next(4);
        expect(outputArray).toEqual([]);
      });
    });

    // These ones are set apart from the rest because we want a cold observable to explicitly test
    // that toggling off unsubscribes and then resubscribes.
    describe('subscription behavior', () => {
      beforeEach(() => {
        source = Observable.of(1, 2, 3);
        outputArray = [];
        output.subscribe(x => outputArray.push(x));
      });

      it('should unsubscribe and resusbscribe when toggled off and back on', () => {
        expect(outputArray).toEqual([]);

        toggler.next(true);

        expect(outputArray).toEqual([1, 2, 3]);

        toggler.next(false);
        toggler.next(true);

        expect(outputArray).toEqual([1, 2, 3, 1, 2, 3]);
      });

      it('should not re-subscribe on duplicate toggler values', () => {
        toggler.next(true);
        toggler.next(true);
        expect(outputArray).toEqual([1, 2, 3]);
      });
    });
  });

  describe('concatLatest', () => {
    it('should work with empty input', () => {
      waitsForPromise(async () => {
        const output = await concatLatest()
          .toArray()
          .toPromise();
        expect(output).toEqual([]);
      });
    });

    it('should work with several observables', () => {
      waitsForPromise(async () => {
        const output = await concatLatest(
          Observable.of([], [1]),
          Observable.of([2]),
          Observable.of([3], [3, 4]),
        )
          .toArray()
          .toPromise();
        expect(output).toEqual([[], [1], [1, 2], [1, 2, 3], [1, 2, 3, 4]]);
      });
    });
  });

  describe('throttle', () => {
    it('emits the leading item immeditately by default', () => {
      const source = Observable.of(1, 2).merge(Observable.never());
      const spy = jasmine.createSpy();
      source.let(throttle(Observable.never())).subscribe(spy);
      expect(spy).toHaveBeenCalledWith(1);
    });

    it("doesn't emit the leading item twice", () => {
      const source = Observable.of(1).merge(Observable.never());
      const notifier = Observable.of(null); // emits immediately on subscription.
      const spy = jasmine.createSpy();
      source.let(throttle(notifier)).subscribe(spy);
      expect(spy.callCount).toBe(1);
    });

    it('throttles', () => {
      const source = new Subject();
      const notifier = new Subject();
      const spy = jasmine.createSpy();
      source.let(throttle(notifier)).subscribe(spy);
      source.next(1);
      spy.reset();
      source.next(2);
      expect(spy).not.toHaveBeenCalled();
      notifier.next();
      expect(spy).toHaveBeenCalledWith(2);
      spy.reset();
      source.next(3);
      expect(spy).not.toHaveBeenCalled();
      source.next(4);
      expect(spy).not.toHaveBeenCalled();
      notifier.next();
      expect(spy).toHaveBeenCalledWith(4);
      expect(spy.callCount).toBe(1);
    });

    it('subscribes to the source once per subscription', () => {
      const spy = jasmine.createSpy();
      const source = Observable.create(spy);
      source.let(throttle(Observable.of(null))).subscribe();
      expect(spy.callCount).toBe(1);
    });
  });

  describe('nextAnimationFrame', () => {
    let oldRequestAnimationFrame;
    let oldCancelAnimationFrame;
    beforeEach(() => {
      oldRequestAnimationFrame = window.requestAnimationFrame;
      oldCancelAnimationFrame = window.cancelAnimationFrame;
      window.requestAnimationFrame = jasmine.createSpy('requestAnimationFrame');
      window.cancelAnimationFrame = jasmine.createSpy('cancelAnimationFrame');
    });

    afterEach(() => {
      window.requestAnimationFrame = oldRequestAnimationFrame;
      window.cancelAnimationFrame = oldCancelAnimationFrame;
    });

    it('schedules next using requestAnimationFrame', () => {
      const sub = nextAnimationFrame.subscribe();
      expect(window.requestAnimationFrame).toHaveBeenCalled();
      sub.unsubscribe();
    });

    it('uses cancelAnimationFrame when unsubscribed', () => {
      const sub = nextAnimationFrame.subscribe();
      expect(window.cancelAnimationFrame).not.toHaveBeenCalled();
      sub.unsubscribe();
      expect(window.cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('bufferUntil', () => {
    it('buffers based on the predicate', () => {
      waitsForPromise(async () => {
        const chunks = await Observable.of(1, 2, 3, 4)
          .let(bufferUntil(x => x % 2 === 0))
          .toArray()
          .toPromise();
        expect(chunks).toEqual([[1, 2], [3, 4]]);
      });
    });

    it('provides the current buffer', () => {
      waitsForPromise(async () => {
        const chunks = await Observable.of(1, 2, 3, 4)
          .let(bufferUntil((x, buffer) => buffer.length === 2))
          .toArray()
          .toPromise();
        expect(chunks).toEqual([[1, 2], [3, 4]]);
      });
    });
  });

  describe('completingSwitchMap', () => {
    it('propagates completions to the inner observable', () => {
      waitsForPromise(async () => {
        const results = await Observable.of(1, 2)
          .let(
            completingSwitchMap(x => {
              return Observable.concat(
                Observable.of(x + 1),
                Observable.never(),
              );
            }),
          )
          .toArray()
          .toPromise();
        expect(results).toEqual([2, 3]);
      });
    });
  });

  describe('fastDebounce', () => {
    it('debounces events', () => {
      waitsForPromise(async () => {
        let nextSpy: JasmineSpy;
        const originalCreate = Observable.create.bind(Observable);
        // Spy on the created observer's next to ensure that we always cancel
        // the last debounced timer on unsubscribe.
        spyOn(Observable, 'create').andCallFake(callback => {
          return originalCreate(observer => {
            nextSpy = spyOn(observer, 'next').andCallThrough();
            return callback(observer);
          });
        });

        const subject = new Subject();
        const promise = subject
          .let(fastDebounce(10))
          .toArray()
          .toPromise();

        subject.next(1);
        subject.next(2);
        advanceClock(20);

        subject.next(3);
        advanceClock(5);

        subject.next(4);
        advanceClock(15);

        subject.next(5);
        subject.complete();
        advanceClock(20);

        expect(await promise).toEqual([2, 4]);
        expect(nextSpy.callCount).toBe(2);
      });
    });

    it('passes errors through immediately', () => {
      let caught = false;
      Observable.throw(1)
        .let(fastDebounce(10))
        .subscribe({
          error() {
            caught = true;
          },
        });
      expect(caught).toBe(true);
    });
  });

  describe('microtask', () => {
    it('is cancelable', () => {
      waitsForPromise(async () => {
        const spy = jasmine.createSpy();
        const sub = microtask.subscribe(spy);
        let resolve;
        const promise = new Promise(r => (resolve = r));
        sub.unsubscribe();
        process.nextTick(() => {
          expect(spy).not.toHaveBeenCalled();
          resolve();
        });
        return promise;
      });
    });
  });

  describe('macrotask', () => {
    it('is cancelable', () => {
      spyOn(global, 'clearImmediate').andCallThrough();
      const sub = macrotask.subscribe(() => {});
      sub.unsubscribe();
      expect(clearImmediate).toHaveBeenCalled();
    });
  });

  describe('toCancellablePromise', () => {
    it('completes successfully', () => {
      waitsForPromise(async () => {
        const source = new Subject();
        const cancellable = toCancellablePromise(source);
        source.next(42);
        source.complete();
        const result = await cancellable.promise;
        expect(result).toBe(42);
      });
    });

    it('error throws from promise', () => {
      waitsForPromise(async () => {
        const source = new Subject();
        const cancellable = toCancellablePromise(source);
        source.error(42);
        let thrown = false;
        try {
          await cancellable.promise;
        } catch (e) {
          expect(e).toBe(42);
          thrown = true;
        }
        expect(thrown).toBe(true);
      });
    });

    it('cancel causes promise to throw', () => {
      waitsForPromise(async () => {
        const source = new Subject();
        const cancellable = toCancellablePromise(source);
        cancellable.cancel();
        let thrown = false;
        try {
          await cancellable.promise;
        } catch (e) {
          thrown = true;
          expect(e instanceof PromiseCancelledError).toBe(true);
        }
        expect(thrown).toBe(true);
      });
    });

    it('cancel after complete is a noop', () => {
      waitsForPromise(async () => {
        const source = new Subject();
        const cancellable = toCancellablePromise(source);
        source.next(42);
        source.complete();
        cancellable.cancel();
        const result = await cancellable.promise;
        expect(result).toBe(42);
      });
    });

    it('cancel after error is a noop', () => {
      waitsForPromise(async () => {
        const source = new Subject();
        const cancellable = toCancellablePromise(source);
        source.error(42);
        let thrown = false;

        // This should not throw, nor should it override the result
        cancellable.cancel();

        try {
          await cancellable.promise;
        } catch (e) {
          expect(e).toBe(42);
          thrown = true;
        }
        expect(thrown).toBe(true);
      });
    });
  });

  describe('SingletonExecutor', () => {
    it('isExecuting()', () => {
      const executor = new SingletonExecutor();
      expect(executor.isExecuting()).toBe(false);

      const source = new Subject();
      const result = executor.execute(source);
      result.catch(() => 'silence unhandled promise rejection warning');
      expect(executor.isExecuting()).toBe(true);

      executor.cancel();
      expect(executor.isExecuting()).toBe(false);
    });

    it('completing task normally', () => {
      waitsForPromise(async () => {
        const executor = new SingletonExecutor();
        const source = new Subject();

        const result = executor.execute(source);
        expect(executor.isExecuting()).toBe(true);

        source.next(42);
        source.complete();
        expect(await result).toBe(42);
        expect(executor.isExecuting()).toBe(false);
      });
    });

    it('completing task by error', () => {
      waitsForPromise(async () => {
        const executor = new SingletonExecutor();
        const source = new Subject();

        const result = executor.execute(source);
        expect(executor.isExecuting()).toBe(true);

        source.error(42);
        let thrown = false;
        try {
          await result;
        } catch (e) {
          expect(e).toBe(42);
          thrown = true;
        }
        expect(executor.isExecuting()).toBe(false);
        expect(thrown).toBe(true);
      });
    });

    it('scheduling second task while first is in flight', () => {
      waitsForPromise(async () => {
        const executor = new SingletonExecutor();

        const source1 = new Subject();
        const result1 = executor.execute(source1);
        expect(executor.isExecuting()).toBe(true);

        const source2 = new Subject();
        const result2 = executor.execute(source2);
        expect(executor.isExecuting()).toBe(true);

        let thrown = false;
        try {
          await result1;
        } catch (e) {
          expect(e instanceof PromiseCancelledError).toBe(true);
          thrown = true;
        }
        expect(executor.isExecuting()).toBe(true);
        expect(thrown).toBe(true);

        source2.next(42);
        source2.complete();

        expect(await result2).toBe(42);
        expect(executor.isExecuting()).toBe(false);
      });
    });
  });
});
