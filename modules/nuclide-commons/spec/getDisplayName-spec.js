/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import getDisplayName from '../getDisplayName';

test('function declaration name', () => {
  expect(getDisplayName(function Foo() {})).toBe('Foo');
});

test('function expression assigned to a variable', () => {
  const Foo = function() {};
  expect(getDisplayName(Foo)).toBe('Foo');
});

test('anonymous function expression', () => {
  // eslint-disable-next-line prefer-arrow-callback
  expect(getDisplayName(function() {})).toBe('Unknown');
});

test('anonymous arrow function', () => {
  expect(getDisplayName(() => {})).toBe('Unknown');
});

test('function expression with displayName assigned to a variable', () => {
  const Foo = function() {};
  Foo.displayName = 'Bar';
  expect(getDisplayName(Foo)).toBe('Bar');
});

test('function expression with displayName assigned to a variable', () => {
  const Foo = function() {};
  Foo.displayName = 'Bar';
  expect(getDisplayName(Foo)).toBe('Bar');
});

test('arrow function with displayName assigned to a variable', () => {
  const Foo = () => {};
  Foo.displayName = 'Bar';
  expect(getDisplayName(Foo)).toBe('Bar');
});

test('class component', () => {
  class Foo {}
  expect(getDisplayName(Foo)).toBe('Foo');
});

test('class component with static displayName', () => {
  class Foo {
    static displayName = 'Bar';
  }
  expect(getDisplayName(Foo)).toBe('Bar');
});
