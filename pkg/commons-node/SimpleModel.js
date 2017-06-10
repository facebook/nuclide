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

import {Observable, Subject} from 'rxjs';
import $$observable from 'symbol-observable';

/**
 * Exposes a simple, React-like OO API for a stateful model. Implements `Symbol.observable` so you
 * can easily convert to an observable stream.
 */
export class SimpleModel<State: {}> {
  state: State;
  _states: Subject<State>;

  constructor() {
    this._states = new Subject();
    this._states.subscribe(state => {
      this.state = state;
    });

    // Create an observable that contains the current, and all future, states. Since the initial
    // state is set directly (assigned to `this.state`), we can't just use a ReplaySubject
    // TODO: Use a computed property key when that's supported.
    (this: any)[$$observable] = () =>
      Observable.of(this.state).concat(this._states);
  }

  setState(newState: Object): void {
    const nextState = {
      ...this.state,
      ...newState,
    };
    this._states.next(nextState);
  }
}
