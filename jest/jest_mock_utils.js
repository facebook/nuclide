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

'use strict';

export const mockFunction = <TArgs: $ReadOnlyArray<any>, TReturn>(
  obj: Object,
  propName: string,
  mockImplementation?: (...TArgs) => TReturn,
) => {
  const mock: JestMockFn<TArgs, TReturn> = jest.fn(mockImplementation);
  obj[propName] = mock;
  return mock;
};

export const getMock = (fn: Function): JestMockFn<any, any> => {
  if (!fn._isMockFunction) {
    throw new Error('Passed function is not a mock');
  }
  return fn;
};
