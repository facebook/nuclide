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

/* eslint-env browser */
/* global IntersectionObserver, PerformanceObserver, ResizeObserver */

import type {Subscriber} from 'rxjs/Subscriber';

import invariant from 'assert';
import {Observable, Subscription} from 'rxjs';
import shallowEqual from 'shallowequal';
import {isIterable} from 'nuclide-commons/collection';

/**
 * Creates an observable sequence from a DOM-style Observer.
 *
 * **Use this sparingly: prefer to use the extended, specialized classes below
 *   or add a new one below when a new DOM-style Observer comes along*
 *
 * Emits the same array or EntryList (as with PerformanceObservers) as the
 * original DOM Observable.
 *
 * Known to work with DOM `MutationObserver`, `IntersectionObserver`,
 * `ResizeObserver`, and `PerformanceObserver`
 *
 * A DOM-style Observer is defined as implementing the `DOMObserver` interface
 * below. Here's an example with `MutationObserver`:
 *
 *   const mutations = DOMObserverObservable.create(
 *    MutationObserver,
 *    document.getElementById('bar'),
 *    { attributes: true, childList: true, characterData: true }
 *   );
 *
 *   mutations.subscribe(record => console.log(record));
 *
 * This emits and logs each batch of MutationRecords unmodified as an array. To
 * emit and log each record individually on the observable, call
 * `.flattenEntries()` before subscribing:
 *
 *   const mutations = DOMObserverObservable.create(
 *    MutationObserver,
 *    document.getElementById('bar'),
 *    { attributes: true, childList: true, characterData: true }
 *   ).flattenEntries();
 *
 *   mutations.subscribe(record => console.log(record));
 *
 * This results in MutationRecord objects emitted *individually* and
 * synchonrously every time a mutation occurs.
 *
 * To add additional observations to the observable, use `observe`:
 *
 *   const mutations = DOMObserverObservable.create(MutationObserver)
 *      .observe(
 *        document.getElementById('bar'),
 *        {attributes: true, childList: true, characterData: true}
 *      )
 *      .observe(
 *        document.getElementById('bar'),
 *        {attributes: true}
 *      )
 *      .flattenEntries();
 *
 *   mutations.subscribe(record => console.log(record));
 */

// $FlowFixMe(>=0.55.0) Flow suppress
type RecordCallback = (records: any, ...rest: Array<any>) => mixed;
interface DOMObserver {
  constructor(callback: RecordCallback, ...rest: Array<any>): DOMObserver,
  observe(...observeArgs: Array<any>): void,
  disconnect(): void,
  +unobserve?: (...unobserveArgs: Array<any>) => void,
}

class DOMObserverObservable<
  TNext, // what does this observable `next()`?
  TEntry, // what is an individual entry?
  TObserveArgs: $ReadOnlyArray<any>, // what are the arguments to `observe()` and `unobserve`()?
> extends Observable<TNext> {
  _DOMObserverCtor: Class<DOMObserver>;
  _observations: Array<TObserveArgs> = [];
  _domObserver: ?DOMObserver;
  _refs: number = 0;

  constructor(
    DOMObserverCtor: Class<DOMObserver>,
    ...observeArgs: TObserveArgs
  ): void {
    super();
    this._DOMObserverCtor = DOMObserverCtor;
    if (observeArgs.length > 0) {
      this.observe(...observeArgs);
    }
  }

  lift<R, S>(
    operator: rxjs$Operator<TNext, R>,
  ): DOMObserverObservable<R, S, TObserveArgs> {
    const obs = new DOMObserverObservable(
      this._DOMObserverCtor,
      ...this._observations[0],
    );
    obs._observations = this._observations.slice();
    obs.source = this;
    obs.operator = operator;
    return obs;
  }

  observe(...observeArgs: TObserveArgs): void {
    this._observations.push(observeArgs);

    if (this._domObserver != null) {
      this._domObserver.observe(...observeArgs);
    }
  }

  unobserve(...unobserveArgs: TObserveArgs): void {
    if (this._domObserver != null && this._domObserver.unobserve == null) {
      throw new Error(
        `Cannot unobserve: This observable has an active ${this._DOMObserverCtor
          .name} and it does not support unobserve`,
      );
    }

    for (let i = 0; i < this._observations.length; i++) {
      if (shallowEqual(this._observations[i], unobserveArgs)) {
        this._observations.splice(i, 1);
        break;
      }
    }

    if (this._domObserver != null && this._domObserver.unobserve != null) {
      this._domObserver.unobserve(...unobserveArgs);
    }
  }

  flattenEntries(): Observable<TEntry> {
    return this.mergeMap(records => {
      if (isIterable(records)) {
        // $FlowFixMe
        return Observable.from(records);
        // $FlowFixMe
      } else if (typeof records.getEntries === 'function') {
        return Observable.from(records.getEntries());
      }

      return Observable.throw(
        new Error(
          'Tried to merge DOM Observer entries, but they were not iterable nor were they an EntryList.',
        ),
      );
    });
  }

  _subscribe(subscriber: Subscriber<TNext>): rxjs$Subscription {
    if (this._refs === 0) {
      invariant(this._domObserver == null);
      this._domObserver = new this._DOMObserverCtor(records => {
        subscriber.next(records);
      });

      for (const observation of this._observations) {
        this._domObserver.observe(...observation);
      }
    }

    const subscription = new Subscription();
    this._refs++;
    subscription.add(() => {
      this._refs--;

      // the underlying observer should only disconnect when all subscribers have
      // unsubscribed
      if (this._refs === 0) {
        invariant(this._domObserver != null);
        this._domObserver.disconnect();
        this._domObserver = null;
      }
    });

    return subscription;
  }
}

export const _DOMObserverObservable = DOMObserverObservable;

/**
 * Returns an RxJS Observable that wraps an IntersectionObserver
 */
export class IntersectionObservable extends DOMObserverObservable<
  Array<IntersectionObserverEntry>,
  IntersectionObserverEntry,
  [HTMLElement],
> {
  constructor(target: HTMLElement) {
    invariant(
      // eslint-disable-next-line eqeqeq
      global.IntersectionObserver !== null,
      'environment must contain IntersectionObserver',
    );
    // $FlowFixMe(>=0.55.0) Flow suppress
    super(IntersectionObserver, target);
  }
}

/**
 * Returns an RxJS Observable that wraps a MutationObserver
 */
export class MutationObservable extends DOMObserverObservable<
  Array<MutationRecord>,
  MutationRecord,
  // $FlowFixMe
  [Node, MutationObserverInit],
> {
  constructor(target: Node, options?: MutationObserverInit) {
    invariant(
      // eslint-disable-next-line eqeqeq
      global.MutationObserver !== null,
      'environment must contain MutationObserver',
    );
    // $FlowFixMe(>=0.55.0) Flow suppress
    super(MutationObserver, target);
  }
}

/**
 * Returns an RxJS Observable that wraps a PerformanceObserver
 */
export class PerformanceObservable extends DOMObserverObservable<
  PerformanceObserverEntryList,
  PerformanceEntry,
  [PerformanceObserverInit],
> {
  constructor(options: PerformanceObserverInit) {
    invariant(
      // eslint-disable-next-line eqeqeq
      global.PerformanceObserver !== null,
      'environment must contain PerformanceObserver',
    );
    // $FlowFixMe(>=0.55.0) Flow suppress
    super(PerformanceObserver, options);
  }
}

/**
 * Returns an RxJS Observable that wraps a ResizeObserver
 */
export class ResizeObservable extends DOMObserverObservable<
  Array<ResizeObserverEntry>,
  ResizeObserverEntry,
  [HTMLElement],
> {
  constructor(target: HTMLElement) {
    invariant(
      // eslint-disable-next-line eqeqeq
      global.ResizeObserver !== null,
      'environment must contain ResizeObserver',
    );
    // $FlowFixMe(>=0.55.0) Flow suppress
    super(ResizeObserver, target);
  }
}
