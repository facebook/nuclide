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
import {arrayEqual} from './collection';

type memoizeUntilChanged = (<A, B, C, D, E, R, U>(
  func: (A, B, C, D, E) => R,
  keySelector_?: (A, B, C, D, E) => U,
  compareKeys_?: (U, U) => boolean,
) => (A, B, C, D, E) => R) &
  (<A, B, C, D, R, U>(
    func: (A, B, C, D) => R,
    keySelector_?: (A, B, C, D) => U,
    compareKeys_?: (U, U) => boolean,
  ) => (A, B, C, D) => R) &
  (<A, B, C, R, U>(
    func: (A, B, C) => R,
    keySelector_?: (A, B, C) => U,
    compareKeys_?: (U, U) => boolean,
  ) => (A, B, C) => R) &
  (<A, B, R, U>(
    func: (A, B) => R,
    keySelector_?: (A, B) => U,
    compareKeys_?: (U, U) => boolean,
  ) => (A, B) => R) &
  (<A, R, U>(
    func: (A) => R,
    keySelector_?: (A) => U,
    compareKeys_?: (U, U) => boolean,
  ) => A => R) &
  (<R>(func: () => R) => () => R) &
  (<T, R, U>(
    func: (...any: $ReadOnlyArray<T>) => R,
    (...any: $ReadOnlyArray<T>) => U,
    compareKeys_?: (U, U) => boolean,
  ) => (...any: $ReadOnlyArray<T>) => R);

/**
 * Create a memoized version of the provided function that caches only the latest result. This is
 * especially useful for optimizing React component methods without having to worry about
 * maintaining state explicitly. For example:
 *
 *     class MyComponent extends React.Component {
 *       constructor(props) {
 *         super(props);
 *         this._computeSomethingExpensive = memoizeUntilChanged(this._computeSomethingExpensive);
 *       }
 *       _computeSomethingExpensive(x) { ... }
 *       render() {
 *         const thingToRender = this._computeSomethingExpensive(this.props.value);
 *         return <div>{thingToRender}</div>;
 *       }
 *     }
 *
 * Sometimes, you need to customize how the arguments are compared. In this case you can pass a
 * key selector function (which derives a single value from the arguments), and an equality function
 * (which compares keys). For example:
 *
 *     class MyComponent extends React.Component {
 *       constructor(props) {
 *         super(props);
 *         this._computeSomethingExpensive = memoizeUntilChanged(
 *           this._computeSomethingExpensive,
 *           (x: Array<Object>, y: Array<Object>) => ({x, y}),
 *           (a, b) => arrayEqual(a.x, b.x) && arrayEqual(a.y, b.y),
 *         );
 *       }
 *       _computeSomethingExpensive(x: Array<Object>, y: Array<Object>) { ... }
 *       render() {
 *         const thingToRender = this._computeSomethingExpensive(this.props.value);
 *         return <div>{thingToRender}</div>;
 *       }
 *     }
 */
export default ((func, keySelector_?, compareKeys_?) => {
  invariant(
    !(keySelector_ == null && compareKeys_ != null),
    "You can't provide a compare function without also providing a key selector.",
  );

  let prevKey = null;
  let prevResult;
  const keySelector = keySelector_ || DEFAULT_KEY_SELECTOR;
  const compareKeys = compareKeys_ || arrayEqual;
  return function(...args) {
    const key = (keySelector: Function)(...args);
    invariant(key != null, 'Key cannot be null');
    if (prevKey == null || !compareKeys(key, prevKey)) {
      prevKey = key;
      prevResult = (func: Function).apply(this, args);
    }
    return prevResult;
  };
}: memoizeUntilChanged);

const DEFAULT_KEY_SELECTOR = (...args) => args;
