/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import {getMock, mockFunction} from '../jest_mock_utils';

test('mocks function', () => {
  const obj = {a: () => 'hey'};
  expect(obj.a()).toBe('hey');
  mockFunction(obj, 'a', () => 'pizza');
  expect(obj.a()).toBe('pizza');
});

test('get mock', () => {
  const obj = {a: arg => 'hey'};
  mockFunction(obj, 'a', () => 'pizza');
  const mock = getMock(obj.a);
  expect(mock).toHaveProperty('_isMockFunction', true);
  mock.mockImplementation(() => 'whiskey');
  expect(obj.a('taco')).toBe('whiskey');
  expect(mock.mock.calls[0][0]).toBe('taco');
});

test('get mock throws when used on a non-mock fn', () => {
  const obj = {a: () => {}};
  expect(() => getMock(obj.a)).toThrowError('is not a mock');
});
