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

import {arePropertiesEqual} from '..';

describe('arePropertiesEqual', () => {
  it('correctly compares empty objects', () => {
    expect(arePropertiesEqual({}, {})).toBe(true);
  });

  it('correctly compares objects with the same properties', () => {
    expect(arePropertiesEqual({foo: 5}, {foo: 5})).toBe(true);
  });

  it('allows one property to be undefined while another does not exist at all', () => {
    expect(arePropertiesEqual({foo: undefined}, {})).toBe(true);
  });

  it('returns false when properties are not equal', () => {
    expect(arePropertiesEqual({foo: 5}, {foo: 4})).toBe(false);
  });

  it('returns false when one property is undefined and another is defined', () => {
    expect(arePropertiesEqual({foo: 5}, {foo: undefined})).toBe(false);
    expect(arePropertiesEqual({foo: undefined}, {foo: 5})).toBe(false);
  });

  it('returns false when one property exists but the other does not', () => {
    expect(arePropertiesEqual({foo: 5}, {})).toBe(false);
    expect(arePropertiesEqual({}, {foo: 5})).toBe(false);
  });
});
