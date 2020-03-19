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

export default function debounce<
  T,
  TArgs: Array<T>,
  TReturn,
  TFunc: (...TArgs) => TReturn, // eslint-disable-line space-before-function-paren
>(
  func: TFunc,
  wait: number,
  immediate?: boolean = false,
): {
  (...TArgs): TReturn | void,
  dispose(): void,
} {
  // Taken from: https://github.com/jashkenas/underscore/blob/b10b2e6d72/underscore.js#L815.
  let timeout: ?TimeoutID;
  let args: ?TArgs;
  let context: any;
  let timestamp = 0;
  let result: TReturn | void;

  const later = function() {
    const last = Date.now() - timestamp;

    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      if (!immediate) {
        invariant(args != null);
        result = func.apply(context, args);
        if (!timeout) {
          context = args = null;
        }
      }
    }
  };

  const debounced = function(...args_: TArgs): TReturn | void {
    context = this;
    args = args_;
    timestamp = Date.now();
    const callNow = immediate && !timeout;
    if (!timeout) {
      timeout = setTimeout(later, wait);
    }
    if (callNow) {
      result = func.apply(context, args);
      context = args = null;
    }

    return result;
  };

  debounced.dispose = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = context = args = null;
    }
  };

  return debounced;
}
