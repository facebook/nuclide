/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

import {ConnectableObservable, Subject} from 'rxjs';

export type CounterChangeEvent = {
  type: string,
  oldValue: number,
  newValue: number,
};

export class Counter {
  _count: number;
  _changes: Subject<CounterChangeEvent>;

  static _counters: Array<Counter> = [];
  static _newCounters = new Subject();

  // Create a new counter with the given initial count.
  constructor(initialCount: number) {
    // Set initial count.
    this._count = initialCount;
    // Set the changes subscription observable.
    this._changes = new Subject();
  }

  static async createCounter(initialCount: number): Promise<Counter> {
    const counter = new Counter(initialCount);
    // Add this counter to global list.
    Counter._counters.push(counter);
    // Broadcast that this counter was created.
    Counter._newCounters.next(counter);
    return counter;
  }

  // Get the current value of a counter.
  async getCount(): Promise<number> {
    return this._count;
  }

  // Add the specified value to the counter's count.
  async addCount(x: number): Promise<void> {
    // Broadcast an event.
    this._changes.next({
      type: 'add',
      oldValue: this._count,
      newValue: this._count + x,
    });
    this._count += x;
  }

  // Subscribe to changes in this counter.
  watchChanges(): ConnectableObservable<CounterChangeEvent> {
    return this._changes.publish();
  }

  // Dispose function that removes this counter from the global list.
  async dispose(): Promise<void> {
    // Remove this counter from the global list.
    Counter._counters.splice(Counter._counters.indexOf(this), 1);
    // Signal that the changes stream is over.
    this._changes.complete();
  }

  /** Static Methods */

  // List all of the counters that have been created.
  static async listCounters(): Promise<Array<Counter>> {
    return Counter._counters;
  }

  // Returns a stream of counters as they are created.
  static watchNewCounters(): ConnectableObservable<Counter> {
    return Counter._newCounters.publish();
  }

  // A static method that takes a Counter object as an argument.
  static async indexOf(counter: Counter): Promise<number> {
    return Counter._counters.indexOf(counter);
  }
}
