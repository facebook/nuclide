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

import {arrayEqual} from './collection';
import Hasher from './Hasher';

type CompareFunc = (a: Array<any>, b: Array<any>) => boolean;
type KeySelector<T, U> = (x: T) => U;

const NOTHING = Symbol('nothing');

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
 */
export default function memoizeUntilChanged<T: Function>(
  func: T,
  keySelector_?: KeySelector<T, any>,
  compareKeys: CompareFunc = arrayEqual,
): T {
  let prevArgKeys;
  let prevResult = NOTHING;
  const keySelector: KeySelector<T, any> = keySelector_ || createKeySelector();
  // $FlowIssue: Flow can't express that we want the args to be the same type as the input func's.
  return function(...args) {
    const argKeys = args.map(keySelector);
    if (prevResult === NOTHING || !compareKeys(argKeys, prevArgKeys)) {
      prevArgKeys = argKeys;
      prevResult = func.apply(this, args);
    }
    return prevResult;
  };
}

function createKeySelector<T>(): KeySelector<T, any> {
  const hasher: Hasher<any> = new Hasher();
  return x => hasher.getHash(x);
}
