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
