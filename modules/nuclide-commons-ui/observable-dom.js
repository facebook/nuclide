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
/* global IntersectionObserver, PerformanceObserver, ResizeObserver, DOMRect */

import type {Subscriber} from 'rxjs/Subscriber';

import invariant from 'assert';
import os from 'os';
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
  constructor(callback: RecordCallback, ...rest: Array<any>): DOMObserver;
  observe(...observeArgs: Array<any>): void;
  disconnect(): void;
  +unobserve?: (...unobserveArgs: Array<any>) => void;
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

  lift<R>(operator: rxjs$Operator<TNext, R>): this {
    const Constructor = this.constructor;
    const [firstObservation, ...restObservations] = this._observations;
    const obs = new Constructor(this._DOMObserverCtor, ...firstObservation);
    for (const observation of restObservations) {
      obs.observe(...observation);
    }
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
        `Cannot unobserve: This observable has an active ${
          this._DOMObserverCtor.name
        } and it does not support unobserve`,
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

    if (os.platform() === 'win32' || os.platform() === 'linux') {
      super(WindowsResizeMeasurementPatchingObserver, target);
    } else {
      // $FlowFixMe(>=0.55.0) Flow suppress
      super(ResizeObserver, target);
    }
  }
}

function lastRectPerTarget(
  entries: Array<ResizeObserverEntry>,
): Map<HTMLElement, DOMRectReadOnly> {
  const rectMap = new Map();
  entries.forEach(entry => rectMap.set(entry.target, entry.contentRect));
  return rectMap;
}

function remeasureContentRect(
  element: HTMLElement,
  contentRect: DOMRectReadOnly,
): DOMRect {
  const {clientHeight, clientWidth} = element;

  // Client height/width include padding
  // https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth
  // We have to strip it to obtain result similar to what the original computed style provided
  const computedStyle = window.getComputedStyle(element);
  const {paddingLeft, paddingRight, paddingTop, paddingBottom} = computedStyle;

  const height =
    clientHeight - parseFloat(paddingTop) - parseFloat(paddingBottom);
  const width =
    clientWidth - parseFloat(paddingLeft) - parseFloat(paddingRight);

  return new DOMRect(contentRect.x, contentRect.y, width, height);
}

/*
 * The values provided by the ResizeOverver on Windows do not seem to reflect the actual size
 * of the element (!!!), so we need to "fix" them before passing on to the downstream subscriber
 * We're wrapping the ResizeObserver instance and are patching the last result of the array with
 * a set of custom measured values
 */
class WindowsResizeMeasurementPatchingObserver implements DOMObserver {
  _resizeObserver: ResizeObserver;

  constructor(callback: RecordCallback, ...rest: Array<any>): DOMObserver {
    const remeasuringCallback = (entries: Array<ResizeObserverEntry>): void => {
      const rebuiltEntries = [];
      const mappedRects = lastRectPerTarget(entries);
      mappedRects.forEach((originalRect, target) => {
        const contentRect = remeasureContentRect(target, originalRect);
        rebuiltEntries.push({target, contentRect});
      });

      callback(rebuiltEntries);
    };
    this._resizeObserver = new ResizeObserver(remeasuringCallback, ...rest);

    // To make flow happy
    return this;
  }

  observe(...observeArgs: Array<any>): void {
    this._resizeObserver.observe(...observeArgs);
  }

  disconnect(): void {
    this._resizeObserver.disconnect();
  }

  unobserve(...unobserveArgs: Array<any>): void {
    if (typeof this._resizeObserver.unobserve === 'function') {
      this._resizeObserver.unobserve(...unobserveArgs);
    }
  }
}
