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

import once from '../once';

describe('once', () => {
  it('correctly calls only once', () => {
    let num = 1;
    const onceFn = once(n => (num += n));
    expect(onceFn(2)).toEqual(3);
    expect(onceFn(2)).toEqual(3);
  });

  it('does not swallow flow types', () => {
    const func = (a: string): number => 1;
    const onceFn = once(func);
    const ret = onceFn('bar');

    (ret: number);
    // $FlowIgnore: func's first param should be a string.
    onceFn(1);
  });
});
