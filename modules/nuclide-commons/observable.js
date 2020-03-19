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

/* global requestAnimationFrame, cancelAnimationFrame */

// NOTE: Custom operators that require arguments should be written as higher-order functions. That
// is, they should accept the arguments and return a function that accepts only an observable. This
// allows a nice ergonomic way of using them with '.let()' (or a potential future pipe operator):
//
//     const makeExciting = (excitementLevel: number = 1) =>
//       (source: Observable<string>) =>
//         source.map(x => x + '!'.repeat(excitementLevel));
//
//     Observable.of('hey', 'everybody')
//       .let(makeExciting())
//       .subscribe(x => console.log(x));

import type {AbortSignal} from './AbortController';

import UniversalDisposable from './UniversalDisposable';
import invariant from 'assert';
// Note: DOMException is usable in Chrome but not in Node.
import DOMException from 'domexception';
import {Observable, ReplaySubject, Subject, Subscription} from 'rxjs';
import AbortController from './AbortController';
import {setDifference} from './collection';
import debounce from './debounce';

/**
 * Splits a stream of strings on newlines.
 * Includes the newlines in the resulting stream (if includeNewlines is true).
 * Sends any non-newline terminated data before closing.
 * Does not ensure a trailing newline.
 */
export function splitStream(
  input: Observable<string>,
  includeNewlines?: boolean = true,
): Observable<string> {
  return Observable.create(observer => {
    let current: string = '';

    function onEnd() {
      if (current !== '') {
        observer.next(current);
        current = '';
      }
    }

    return input.subscribe(
      value => {
        const lines = value.split('\n');
        lines[0] = current + lines[0];
        current = lines.pop();
        if (includeNewlines) {
          lines.forEach(line => observer.next(line + '\n'));
        } else {
          lines.forEach(line => observer.next(line));
        }
      },
      error => {
        onEnd();
        observer.error(error);
      },
      () => {
        onEnd();
        observer.complete();
      },
    );
  });
}

/**
 * Buffers until the predicate matches an element, then opens a new buffer.
 *
 * @param stream - The observable to buffer
 * @param predicate - A function that will be called every time an element is emitted from the
 *     source. The predicate is passed the current element as well as the buffer at that point
 *     (which includes the element). IMPORTANT: DO NOT MUTATE THE BUFFER. It returns a boolean
 *     specifying whether to complete the buffer (and begin a new one).
 */
export function bufferUntil<T>(
  condition: (item: T, buffer: Array<T>) => boolean,
): (Observable<T>) => Observable<Array<T>> {
  return (stream: Observable<T>) =>
    Observable.create(observer => {
      let buffer = null;
      const flush = () => {
        if (buffer != null) {
          observer.next(buffer);
          buffer = null;
        }
      };
      return stream.subscribe(
        x => {
          if (buffer == null) {
            buffer = [];
          }
          buffer.push(x);
          if (condition(x, buffer)) {
            flush();
          }
        },
        err => {
          flush();
          observer.error(err);
        },
        () => {
          flush();
          observer.complete();
        },
      );
    });
}

/**
 * Caches the latest element as long as there are subscribers. This is useful so that if consumers
 * unsubscribe and then subscribe much later, they do not get an ancient cached value.
 *
 * This is intended to be used with cold Observables. If you have a hot Observable, `cache(1)` will
 * be just fine because the hot Observable will continue producing values even when there are no
 * subscribers, so you can be assured that the cached values are up-to-date.
 */
export function cacheWhileSubscribed<T>(input: Observable<T>): Observable<T> {
  return input.multicast(() => new ReplaySubject(1)).refCount();
}

type Diff<T> = {
  added: Set<T>,
  removed: Set<T>,
};

/**
 * Given a stream of sets, return a stream of diffs.
 * **IMPORTANT:** These sets are assumed to be immutable by convention. Don't mutate them!
 */
export function diffSets<T>(
  hash?: (v: T) => any,
): (Observable<Set<T>>) => Observable<Diff<T>> {
  return (sets: Observable<Set<T>>) =>
    Observable.concat(
      Observable.of(new Set()), // Always start with no items with an empty set
      sets,
    )
      .pairwise()
      .map(([previous, next]) => ({
        added: setDifference(next, previous, hash),
        removed: setDifference(previous, next, hash),
      }))
      .filter(diff => diff.added.size > 0 || diff.removed.size > 0);
}

/**
 * Give a stream of diffs, perform an action for each added item and dispose of the returned
 * disposable when the item is removed.
 */
export function reconcileSetDiffs<T>(
  diffs: Observable<Diff<T>>,
  addAction: (addedItem: T) => IDisposable,
  hash_?: (v: T) => any,
): IDisposable {
  const hash = hash_ || (x => x);
  const itemsToDisposables = new Map();
  const disposeItem = item => {
    const disposable = itemsToDisposables.get(hash(item));
    invariant(disposable != null);
    disposable.dispose();
    itemsToDisposables.delete(item);
  };
  const disposeAll = () => {
    itemsToDisposables.forEach(disposable => {
      disposable.dispose();
    });
    itemsToDisposables.clear();
  };

  return new UniversalDisposable(
    diffs.subscribe(diff => {
      // For every item that got added, perform the add action.
      diff.added.forEach(item => {
        itemsToDisposables.set(hash(item), addAction(item));
      });

      // "Undo" the add action for each item that got removed.
      diff.removed.forEach(disposeItem);
    }),
    disposeAll,
  );
}

/**
 * Given a stream of sets, perform a side-effect whenever an item is added (i.e. is present in a
 * set but wasn't in the previous set in the stream), and a corresponding cleanup when it's removed.
 * **IMPORTANT:** These sets are assumed to be immutable by convention. Don't mutate them!
 *
 * Example:
 *
 *    const dogs = Observable.of(
 *      new Set([{name: 'Winston', id: 1}, {name: 'Penelope', id: 2}]),
 *      new Set([{name: 'Winston', id: 1}]),
 *    );
 *    const disposable = reconcileSets(
 *      dogs,
 *      dog => {
 *        const notification = atom.notifications.addSuccess(
 *          `${dog.name} was added!`,
 *          {dismissable: true},
 *        );
 *        return new Disposable(() => { notification.dismiss(); });
 *      },
 *      dog => dog.id,
 *    );
 *
 * The above code will first add notifications saying "Winston was added!" and "Penelope was
 * added!", then dismiss the "Penelope" notification. Since the Winston object is in the final set
 * of the dogs observable, his notification will remain until `disposable.dispose()` is called, at
 * which point the cleanup for all remaining items will be performed.
 */
export function reconcileSets<T>(
  sets: Observable<Set<T>>,
  addAction: (addedItem: T) => IDisposable,
  hash?: (v: T) => any,
): IDisposable {
  const diffs = sets.let(diffSets(hash));
  return reconcileSetDiffs(diffs, addAction, hash);
}

export function toggle<T>(
  toggler: Observable<boolean>,
): (Observable<T>) => Observable<T> {
  return (source: Observable<T>) =>
    toggler
      .distinctUntilChanged()
      .switchMap(enabled => (enabled ? source : Observable.empty()));
}

export function compact<T>(source: Observable<?T>): Observable<T> {
  // Flow does not understand the semantics of `filter`
  return (source.filter(x => x != null): any);
}

/**
 * Like `takeWhile`, but includes the first item that doesn't match the predicate.
 */
export function takeWhileInclusive<T>(
  predicate: (value: T) => boolean,
): (Observable<T>) => Observable<T> {
  return (source: Observable<T>) =>
    Observable.create(observer =>
      source.subscribe(
        x => {
          observer.next(x);
          if (!predicate(x)) {
            observer.complete();
          }
        },
        err => {
          observer.error(err);
        },
        () => {
          observer.complete();
        },
      ),
    );
}

// Concatenate the latest values from each input observable into one big list.
// Observables who have not emitted a value yet are treated as empty.
export function concatLatest<T>(
  ...observables: Array<Observable<Array<T>>>
): Observable<Array<T>> {
  // First, tag all input observables with their index.
  // Flow errors with ambiguity without the explicit annotation.
  const tagged: Array<Observable<[Array<T>, number]>> = observables.map(
    (observable, index) => observable.map(list => [list, index]),
  );
  return Observable.merge(...tagged)
    .scan((accumulator, [list, index]) => {
      accumulator[index] = list;
      return accumulator;
    }, observables.map(x => []))
    .map(accumulator => [].concat(...accumulator));
}

// Use a sentinel so we can distinguish between when `null` is emitted and when
// nothing is.
const NONE = {};

type ThrottleOptions = {|
  leading?: boolean,
|};

export function throttle<T>(
  delay:
    | number
    | ((value: T) => Observable<any> | Promise<any>)
    | Observable<any>
    | Promise<any>,
  options?: ThrottleOptions = {leading: true},
): (observable: Observable<T>) => Observable<T> {
  let getDelay: (value: T) => Observable<any> | Promise<any>;
  switch (typeof delay) {
    case 'number':
      getDelay = () => Observable.timer(delay);
      break;
    case 'function':
      getDelay = delay;
      break;
    case 'object':
      getDelay = () => delay;
      break;
    default:
      throw new Error(`Invalid delay: ${delay}`);
  }

  return function doThrottle(source: Observable<T>): Observable<T> {
    return Observable.create(observer => {
      const {leading = true} = options;
      const timerStarts = new Subject();
      let latestValue = NONE;
      let latestValueIsLeading = false;
      let shouldIgnore = false;

      const checkShouldNext = () => {
        if (!shouldIgnore && latestValue !== NONE) {
          // At this point, latestValue must be of type T
          latestValue = ((latestValue: any): T);

          const valueToDispatch = latestValue;
          shouldIgnore = true;

          if (leading || !latestValueIsLeading) {
            latestValue = NONE;
            observer.next(valueToDispatch);
          }
          timerStarts.next(valueToDispatch);
        }
      };

      const sub = new Subscription();
      sub.add(
        timerStarts
          .switchMap(x => {
            const timer = getDelay(x);
            if (timer instanceof Observable) {
              return timer.take(1);
            } else {
              return timer;
            }
          })
          .subscribe(() => {
            shouldIgnore = false;
            latestValueIsLeading = false;
            checkShouldNext();
          }),
      );
      sub.add(
        source.subscribe({
          next: x => {
            latestValue = x;
            latestValueIsLeading = true;
            checkShouldNext();
          },
          error: err => {
            observer.error(err);
          },
          complete: () => {
            // Ensure we don't hold a reference to the last value.
            latestValue = NONE;
            observer.complete();
          },
        }),
      );

      return sub;
    });
  };
}

/**
 * Returns a new function which takes an `observable` and returns
 * `observable.switchMap(project)`, except that it completes
 * when the outer observable completes.
 *
 * Example:
 *
 *   Observable.of(1)
 *     .let(completingSwitchMap(x => Observable.never()))
 *
 * ends up returning an Observable that completes immediately.
 * With a regular switchMap, this would never terminate.
 */
export function completingSwitchMap<T, U>(
  project: (input: T, index: number) => rxjs$ObservableInput<U>,
): (Observable<T>) => Observable<U> {
  // An alternative implementation is to materialize the input observable,
  // but this avoids the creation of extra notifier objects.
  const completedSymbol = Symbol('completed');
  return (observable: Observable<T>) =>
    Observable.concat(
      observable,
      Observable.of((completedSymbol: any)),
    ).switchMap((input, index) => {
      if (input === completedSymbol) {
        return Observable.empty();
      }
      return project(input, index);
    });
}

/**
 * Returns a new observable consisting of the merged values from the passed
 * observables and completes when the first inner observable completes.
 */
export function mergeUntilAnyComplete<T>(
  ...observables: Array<Observable<T>>
): Observable<T> {
  const notifications = Observable.merge(
    ...observables.map(o => o.materialize()),
  );
  // $FlowFixMe add dematerialize to rxjs Flow types
  return notifications.dematerialize();
}

/**
 * RxJS's debounceTime is actually fairly inefficient:
 * on each event, it always clears its interval and [creates a new one][1].
 * Until this is fixed, this uses our debounce implementation which
 * reuses a timeout and just sets a timestamp when possible.
 *
 * This may seem like a micro-optimization but we often use debounces
 * for very hot events, like keypresses. Exceeding the frame budget can easily lead
 * to increased key latency!
 *
 * [1]: https://github.com/ReactiveX/rxjs/blob/master/src/operators/debounceTime.ts#L106
 */
export function fastDebounce<T>(
  delay: number,
): (Observable<T>) => Observable<T> {
  return (observable: Observable<T>) =>
    Observable.create(observer => {
      const debouncedNext = debounce((x: T) => observer.next(x), delay);
      const subscription = observable.subscribe(
        debouncedNext,
        observer.error.bind(observer),
        observer.complete.bind(observer),
      );
      return new UniversalDisposable(subscription, debouncedNext);
    });
}

export const microtask = Observable.create(observer => {
  process.nextTick(() => {
    observer.next();
    observer.complete();
  });
});

export const macrotask = Observable.create(observer => {
  const timerId = setImmediate(() => {
    observer.next();
    observer.complete();
  });
  return () => {
    clearImmediate(timerId);
  };
});

export const nextAnimationFrame = Observable.create(observer => {
  if (typeof requestAnimationFrame === 'undefined') {
    throw new Error('This util can only be used in Atom');
  }
  const id = requestAnimationFrame(() => {
    observer.next();
    observer.complete();
  });
  return () => {
    cancelAnimationFrame(id);
  };
});

/**
 * Creates an Observable around an abortable promise.
 * Unsubscriptions are forwarded to the AbortController as an `abort()`.
 * Example usage (with an abortable fetch):
 *
 *   fromPromise(signal => fetch(url, {...options, signal}))
 *     .switchMap(....)
 *
 * Note that this can take a normal `() => Promise<T>` too
 * (in which case this acts as just a plain `Observable.defer`).
 */
export function fromAbortablePromise<T>(
  func: (signal: AbortSignal) => Promise<T>,
): Observable<T> {
  return Observable.create(observer => {
    let completed = false;
    const abortController = new AbortController();
    func(abortController.signal).then(
      value => {
        completed = true;
        observer.next(value);
        observer.complete();
      },
      error => {
        completed = true;
        observer.error(error);
      },
    );
    return () => {
      if (!completed) {
        abortController.abort();
        // If the promise adheres to the spec, it should throw.
        // The error will be captured above but go into the void.
      }
    };
  });
}

/**
 * Converts an observable + AbortSignal into a cancellable Promise,
 * which rejects with an AbortError DOMException on abort.
 * Useful when writing the internals of a cancellable promise.
 *
 * Usage:
 *
 *   function abortableFunction(arg1: blah, options?: {signal?: AbortSignal}): Promise {
 *     return toPromise(
 *       observableFunction(arg1, options),
 *       options && options.signal,
 *     );
 *   }
 *
 * Could eventually be replaced by Observable.first if
 * https://github.com/whatwg/dom/issues/544 goes through.
 *
 * It's currently unclear if this should be usable with let/pipe:
 * https://github.com/ReactiveX/rxjs/issues/3445
 */
export function toAbortablePromise<T>(
  observable: Observable<T>,
  signal?: ?AbortSignal,
): Promise<T> {
  if (signal == null) {
    return observable.toPromise();
  }
  if (signal.aborted) {
    return Promise.reject(DOMException('Aborted', 'AbortError'));
  }
  return observable
    .race(
      Observable.fromEvent(signal, 'abort').map(() => {
        throw new DOMException('Aborted', 'AbortError');
      }),
    )
    .toPromise();
}

/**
 * When using Observables with AbortSignals, be sure to use this -
 * it's really easy to miss the case when the signal is already aborted!
 * Recommended to use this with let/pipe:
 *
 *   myObservable
 *     .let(takeUntilAbort(signal))
 */
export function takeUntilAbort<T>(
  signal: AbortSignal,
): (Observable<T>) => Observable<T> {
  return observable =>
    Observable.defer(() => {
      if (signal.aborted) {
        return Observable.empty();
      }
      return observable.takeUntil(Observable.fromEvent(signal, 'abort'));
    });
}

// Executes tasks. Ensures that at most one task is running at a time.
// This class is handy for expensive tasks like processes, provided
// you never want the result of a previous task after a new task has started.
export class SingletonExecutor<T> {
  _abortController: ?AbortController = null;

  // Executes(subscribes to) the task.
  // Will terminate(unsubscribe) to any previously executing task.
  // Subsequent executes() will terminate this task if called before
  // this task completes.
  async execute(createTask: Observable<T>): Promise<T> {
    // Kill any previously running processes
    this.cancel();

    // Start a new process
    const controller = new AbortController();
    this._abortController = controller;

    // Wait for the process to complete or be canceled ...
    try {
      return await toAbortablePromise(createTask, controller.signal);
    } finally {
      // ... and always clean up if we haven't been canceled already.
      if (controller === this._abortController) {
        this._abortController = null;
      }
    }
  }

  isExecuting(): boolean {
    return this._abortController != null;
  }

  // Cancels any currently executing tasks.
  cancel(): void {
    if (this._abortController != null) {
      this._abortController.abort();
      this._abortController = null;
    }
  }
}

/**
 * Repeatedly subscribe to an observable every `delay` milliseconds, waiting for the observable to
 * complete each time. This is preferable to, say, `Observable.interval(d).switchMap(() => source)`
 * because, in the case that `source` takes longer than `d` milliseconds to produce a value, that
 * formulation will never produce a value (while continuing to incur the overhead of subscribing to
 * source).
 *
 * Example:
 *
 *    // Ask what time it is every second until it's Friday.
 *    runCommand('date')
 *      .let(poll(1000))
 *      .filter(output => output.startsWith('Fri'))
 *      .take(1)
 *      .subscribe(() => {
 *        console.log("IT'S FRIDAY!!")
 *      });
 *
 */
export function poll<T>(delay: number): (Observable<T>) => Observable<T> {
  return (source: Observable<T>) =>
    Observable.defer(() => {
      const delays = new Subject();
      return delays
        .switchMap(n => Observable.timer(n))
        .merge(Observable.of(null))
        .switchMap(() => {
          const subscribedAt = Date.now();
          return source.do({
            complete: () => {
              const timeElapsed = Date.now() - subscribedAt;
              delays.next(Math.max(0, delay - timeElapsed));
            },
          });
        });
    });
}
