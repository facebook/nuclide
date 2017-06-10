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

export default function once<
  T,
  TArgs: Array<T>,
  TReturn,
  TFunc: (...TArgs) => TReturn, // eslint-disable-line space-before-function-paren
>(fn: TFunc): (...TArgs) => TReturn {
  let fnMaybe: ?TFunc = fn;
  let ret: ?TReturn;
  return function(...args: TArgs): TReturn {
    // The type gymnastics here are so `fn` can be
    // garbage collected once we've used it.
    if (!fnMaybe) {
      return (ret: any);
    } else {
      ret = fnMaybe.apply(this, args);
      fnMaybe = null;
      return ret;
    }
  };
}
