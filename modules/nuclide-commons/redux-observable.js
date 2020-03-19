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

// Derived from <https://github.com/redux-observable/redux-observable/> because their version
// imports an Rx operator module and we use a bundle. Original license follows:
//
// The MIT License (MIT)
//
// Copyright (c) 2016 Ben Lesh
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import {Observable, Subject} from 'rxjs';

// This should be { type: readonly string } when we get readonly props. Because this is used with
// disjoint unions we can't use `string` here due to mutation concerns. Flow doesn't know that we
// aren't going to mutate the objects with a random string value so it can't allow us to pass a
// specific action type into something of type { type: string }
type Action = {type: any};
type Store<T: Action, U> = {
  dispatch(action: T): void,
  getState(): U,
  subscribe(listener: () => void): () => void,
  replaceReducer(reducer: () => mixed): void,
};
type Next<T: Action> = (action: T) => T;
export type Epic<T: Action, U, E> = (
  actions: ActionsObservable<T>,
  store: Store<T, U>,
  extra: E,
) => Observable<T>;

export function combineEpics<T: Action, U, E>(
  ...epics: Array<Epic<T, U, E>>
): Epic<T, U, E> {
  return (actions: ActionsObservable<T>, store: Store<T, U>, extra: E) => {
    const streams: Array<Observable<T>> = epics.map(epic =>
      epic(actions, store, extra),
    );
    return Observable.merge(...streams);
  };
}

export function createEpicMiddleware<T: Action, U>(
  rootEpic?: Epic<T, U, void>,
) {
  const actions = new Subject();
  const actionsObs = new ActionsObservable(actions);

  return (store: Store<T, U>) => (next: Next<T>) => {
    if (rootEpic != null) {
      // eslint-disable-next-line nuclide-internal/unused-subscription
      rootEpic(actionsObs, store).subscribe(store.dispatch);
    }
    return (action: T) => {
      const result = next(action);
      actions.next(action);
      return result;
    };
  };
}

export class ActionsObservable<T: Action> extends Observable<T> {
  operator: any;

  constructor(actionsSubject: Observable<any>) {
    super();
    this.source = actionsSubject;
  }

  lift(operator: any): Observable<T> {
    const observable = new ActionsObservable(this);
    observable.operator = operator;
    return observable;
  }

  ofType(...keys: Array<any>): ActionsObservable<T> {
    const result = this.filter(({type}) => {
      const len = keys.length;
      if (len === 1) {
        return type === keys[0];
      } else {
        for (let i = 0; i < len; i++) {
          if (keys[i] === type) {
            return true;
          }
        }
      }
      return false;
    });
    return ((result: any): ActionsObservable<T>);
  }
}
