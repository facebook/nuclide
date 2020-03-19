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
import type {AbortSignal} from '../AbortController';

import {
  bufferUntil,
  cacheWhileSubscribed,
  completingSwitchMap,
  mergeUntilAnyComplete,
  concatLatest,
  diffSets,
  fastDebounce,
  fromAbortablePromise,
  macrotask,
  microtask,
  nextAnimationFrame,
  poll,
  reconcileSetDiffs,
  SingletonExecutor,
  splitStream,
  takeUntilAbort,
  takeWhileInclusive,
  toAbortablePromise,
  toggle,
} from '../observable';
import nullthrows from 'nullthrows';
import AbortController from '../AbortController';
import UniversalDisposable from '../UniversalDisposable';
import {Observable, Subject} from 'rxjs';

const setsAreEqual = (a, b) =>
  a.size === b.size && Array.from(a).every(b.has.bind(b));
const diffsAreEqual = (a, b) =>
  setsAreEqual(a.added, b.added) && setsAreEqual(a.removed, b.removed);
const createDisposable = () => {
  const disposable = new UniversalDisposable();
  jest.spyOn(disposable, 'dispose');
  return disposable;
};

describe('nuclide-commons/observable', () => {
  describe('splitStream', () => {
    it('splits streams', async () => {
      const input = ['foo\nbar', '\n', '\nba', 'z', '\nblar'];
      const output = await splitStream(Observable.from(input))
        .toArray()
        .toPromise();
      expect(output).toEqual(['foo\n', 'bar\n', '\n', 'baz\n', 'blar']);
    });

    it('splits streams without the newline', async () => {
      const input = ['foo\nbar', '\n', '\nba', 'z', '\nblar'];
      const output = await splitStream(Observable.from(input), false)
        .toArray()
        .toPromise();
      expect(output).toEqual(['foo', 'bar', '', 'baz', 'blar']);
    });
  });

  describe('takeWhileInclusive', () => {
    it('completes the stream when something matches the predicate', () => {
      const source = new Subject();
      const result = source.let(takeWhileInclusive(x => x !== 2));
      const next: (n: number) => mixed = jest.fn();
      const complete: () => mixed = jest.fn();
      result.subscribe({next, complete});
      source.next(1);
      source.next(2);
      source.next(3);
      expect(complete).toHaveBeenCalled();
      expect(next.mock.calls.map(call => call[0])).toEqual([1, 2]);
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
    it('emits a diff for the first item', async () => {
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

    it('correctly identifies removed items', async () => {
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

    it('correctly identifies removed items when a hash function is used', async () => {
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

    it('correctly identifies added items', async () => {
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

    it('correctly identifies added items when a hash function is used', async () => {
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

    it("doesn't emit a diff when nothing changes", async () => {
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

    it("doesn't emit a diff when nothing changes and a hash function is used", async () => {
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

  describe('reconcileSetDiffs', () => {
    it("calls the add action for each item that's added", () => {
      const diffs = new Subject();
      const addAction = jest.fn().mockReturnValue(new UniversalDisposable());
      reconcileSetDiffs(diffs, addAction);
      diffs.next({
        added: new Set(['a', 'b']),
        removed: new Set(),
      });
      expect(addAction.mock.calls.map(call => call[0])).toEqual(['a', 'b']);
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
    it('should work with empty input', async () => {
      const output = await concatLatest()
        .toArray()
        .toPromise();
      expect(output).toEqual([]);
    });

    it('should work with several observables', async () => {
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

  describe('nextAnimationFrame', () => {
    let oldRequestAnimationFrame;
    let oldCancelAnimationFrame;
    beforeEach(() => {
      oldRequestAnimationFrame = window.requestAnimationFrame;
      oldCancelAnimationFrame = window.cancelAnimationFrame;
      window.requestAnimationFrame = jest.fn();
      window.cancelAnimationFrame = jest.fn();
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
    it('buffers based on the predicate', async () => {
      const chunks = await Observable.of(1, 2, 3, 4)
        .let(bufferUntil(x => x % 2 === 0))
        .toArray()
        .toPromise();
      expect(chunks).toEqual([[1, 2], [3, 4]]);
    });

    it('provides the current buffer', async () => {
      const chunks = await Observable.of(1, 2, 3, 4)
        .let(bufferUntil((x, buffer) => buffer.length === 2))
        .toArray()
        .toPromise();
      expect(chunks).toEqual([[1, 2], [3, 4]]);
    });
  });

  describe('completingSwitchMap', () => {
    it('propagates completions to the inner observable', async () => {
      await (async () => {
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
      })();
    });
  });

  describe('mergeUntilAnyComplete', () => {
    it('completes when the first inner observable completes', async () => {
      const aDone = jest.fn();
      const bDone = jest.fn();
      const a = Observable.timer(0, 10)
        .mapTo('A')
        .take(100)
        .finally(aDone);
      const b = Observable.timer(5, 10)
        .mapTo('B')
        .take(3)
        .finally(bDone);
      const results = await mergeUntilAnyComplete(a, b)
        .toArray()
        .toPromise();
      expect(results).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
      expect(aDone).toHaveBeenCalled();
      expect(bDone).toHaveBeenCalled();
    });
  });

  describe('fastDebounce', () => {
    it('debounces events', async () => {
      let nextSpy;
      const originalCreate = Observable.create.bind(Observable);
      // Spy on the created observer's next to ensure that we always cancel
      // the last debounced timer on unsubscribe.
      jest.spyOn(Observable, 'create').mockImplementation(callback => {
        return originalCreate(observer => {
          nextSpy = jest.spyOn(observer, 'next');
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
      await sleep(20);

      subject.next(3);
      await sleep(5);

      subject.next(4);
      await sleep(15);

      subject.next(5);
      subject.complete();
      await sleep(20);

      expect(await promise).toEqual([2, 4]);
      expect(nullthrows(nextSpy).mock.calls.length).toBe(2);
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
    it('is cancelable', async () => {
      await (async () => {
        const spy = jest.fn();
        const sub = microtask.subscribe(spy);
        let resolve;
        const promise = new Promise(r => (resolve = r));
        sub.unsubscribe();
        process.nextTick(() => {
          expect(spy).not.toHaveBeenCalled();
          resolve();
        });
        return promise;
      })();
    });
  });

  describe('macrotask', () => {
    it('is cancelable', () => {
      jest.spyOn(global, 'clearImmediate');
      const sub = macrotask.subscribe(() => {});
      sub.unsubscribe();
      expect(clearImmediate).toHaveBeenCalled();
    });
  });

  describe('fromAbortablePromise', () => {
    it('is able to cancel a promise after unsubscription', () => {
      const spy = jest.fn();
      function f(signal: AbortSignal) {
        expect(signal.aborted).toBe(false);
        signal.onabort = spy;
        return new Promise(resolve => {});
      }
      const subscription = fromAbortablePromise(f).subscribe();
      subscription.unsubscribe();
      expect(spy).toHaveBeenCalled();
    });

    it('does not trigger an abort after normal completion', async () => {
      await (async () => {
        const spy = jest.fn();
        function f(signal: AbortSignal) {
          signal.onabort = spy;
          return Promise.resolve(1);
        }
        const result = await fromAbortablePromise(f).toPromise();
        expect(result).toBe(1);
        expect(spy).not.toHaveBeenCalled();
      })();
    });
  });

  describe('toAbortablePromise', () => {
    it('rejects with a DOMException on abort', async () => {
      const controller = new AbortController();
      const spy = jest.fn();
      const promise = toAbortablePromise(
        Observable.never(),
        controller.signal,
      ).catch(spy);
      controller.abort();
      await promise;

      expect(spy).toHaveBeenCalled();
      const exception: any = spy.mock.calls[0][0];
      expect(exception.constructor.name).toBe('DOMException');
      expect(exception.name).toBe('AbortError');
      expect(exception.message).toBe('Aborted');
    });

    describe('takeUntilAbort', () => {
      it('completes on abort', () => {
        const controller = new AbortController();

        const spy = jest.fn();
        Observable.never()
          .let(takeUntilAbort(controller.signal))
          .subscribe({complete: spy});

        expect(spy).not.toHaveBeenCalled();
        controller.abort();
        expect(spy).toHaveBeenCalled();
      });

      it('completes when already aborted', () => {
        const controller = new AbortController();
        controller.abort();

        const spy = jest.fn();
        Observable.never()
          .let(takeUntilAbort(controller.signal))
          .subscribe({complete: spy});

        expect(spy).toHaveBeenCalled();
      });
    });

    it('works with no signal', async () => {
      const promise = toAbortablePromise(Observable.of(1));
      expect(await promise).toBe(1);
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

    it('completing task normally', async () => {
      const executor = new SingletonExecutor();
      const source = new Subject();

      const result = executor.execute(source);
      expect(executor.isExecuting()).toBe(true);

      source.next(42);
      source.complete();
      expect(await result).toBe(42);
      expect(executor.isExecuting()).toBe(false);
    });

    it('completing task by error', async () => {
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

    it('scheduling second task while first is in flight', async () => {
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
        expect(e.name).toBe('AbortError');
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

  describe('poll', () => {
    beforeEach(() => {});

    it('subscribes to the observable synchronously', () => {
      const source = Observable.never();
      const spy = jest.spyOn(source, 'subscribe');
      const sub = source.let(poll(10)).subscribe();
      expect(spy.mock.calls.length).toBe(1);
      sub.unsubscribe();
    });

    it('resubscribes when complete', async () => {
      let mostRecentObserver;
      const source = Observable.create(observer => {
        mostRecentObserver = observer;
      });
      const spy = jest.spyOn(source, 'subscribe');
      const sub = source.let(poll(10)).subscribe();
      expect(spy.mock.calls.length).toBe(1);
      (mostRecentObserver: any).next();

      // Even though we're waiting longer than the delay, it hasn't completed yet so we shouldn't
      // resubscribe.
      await sleep(30);
      expect(spy.mock.calls.length).toBe(1);
      (mostRecentObserver: any).complete();
      expect(spy.mock.calls.length).toBe(1);

      // Now that the source has completed, we should subscribe again.
      await sleep(30);
      expect(spy.mock.calls.length).toBe(2);
      sub.unsubscribe();
    });

    it("doesn't resubscribe to the source when you unsubscribe", async () => {
      const source = new Subject();
      const spy = jest.spyOn(source, 'subscribe');
      source
        .let(poll(10))
        .take(1) // This will unsubscribe after the first element.
        .subscribe();
      expect(spy.mock.calls.length).toBe(1);
      source.next();
      await sleep(30);
      expect(spy.mock.calls.length).toBe(1);
    });

    it('polls synchronously completing observables', async () => {
      const result = await Observable.of('hi')
        .let(poll(10))
        .take(2)
        .toArray()
        .toPromise();
      expect(result).toEqual(['hi', 'hi']);
    });
  });
});

const sleep = n =>
  new Promise(resolve => {
    setTimeout(resolve, n);
  });
