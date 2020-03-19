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

import invariant from 'assert';

import {
  MIRegisterSimpleValue,
  MIRegisterIndexedValues,
  MIRegisterNamedValues,
  MIRegisterValueParser,
} from '../lib/MIRegisterValue';

describe('MIRegisterValue', () => {
  it('should parse a simple value', () => {
    const textValue = '0x7fff5fbff1d4';
    const parser = new MIRegisterValueParser(textValue);
    const value = parser.parse();

    expect(value instanceof MIRegisterSimpleValue).toBeTruthy();
    invariant(value instanceof MIRegisterSimpleValue);

    expect(value.value).toBe('0x7fff5fbff1d4');
  });

  it('should parse an indexed list', () => {
    const textValue = '{0xc3, 0xf5}';
    const parser = new MIRegisterValueParser(textValue);
    const value = parser.parse();

    expect(value instanceof MIRegisterIndexedValues).toBeTruthy();
    invariant(value instanceof MIRegisterIndexedValues);
    expect(value.length).toBe(2);

    const value0 = value.valueAt('0');
    expect(value0 instanceof MIRegisterSimpleValue).toBeTruthy();
    invariant(value0 instanceof MIRegisterSimpleValue);
    expect(value0.value).toBe('0xc3');

    const value1 = value.valueAt('1');
    expect(value1 instanceof MIRegisterSimpleValue).toBeTruthy();
    invariant(value1 instanceof MIRegisterSimpleValue);
    expect(value1.value).toBe('0xf5');
  });

  it('should parse an indexed list with compressed entries', () => {
    const textValue = '{0xc3, 0xf5 <repeats 2 times>}';
    const parser = new MIRegisterValueParser(textValue);
    const value = parser.parse();

    expect(value instanceof MIRegisterIndexedValues).toBeTruthy();
    invariant(value instanceof MIRegisterIndexedValues);
    expect(value.length).toBe(3);

    const value0 = value.valueAt('0');
    expect(value0 instanceof MIRegisterSimpleValue).toBeTruthy();
    invariant(value0 instanceof MIRegisterSimpleValue);
    expect(value0.value).toBe('0xc3');

    const value1 = value.valueAt('1');
    expect(value1 instanceof MIRegisterSimpleValue).toBeTruthy();
    invariant(value1 instanceof MIRegisterSimpleValue);
    expect(value1.value).toBe('0xf5');

    const value2 = value.valueAt('2');
    expect(value2 instanceof MIRegisterSimpleValue).toBeTruthy();
    invariant(value2 instanceof MIRegisterSimpleValue);
    expect(value2.value).toBe('0xf5');
  });

  it('should parse a named list', () => {
    const textValue = '{a = 0xc3, b = 0xf5}';
    const parser = new MIRegisterValueParser(textValue);
    const value = parser.parse();

    expect(value instanceof MIRegisterNamedValues).toBeTruthy();
    invariant(value instanceof MIRegisterNamedValues);
    expect(value.names.length).toBe(2);
    expect(value.names.includes('a')).toBeTruthy();
    expect(value.names.includes('b')).toBeTruthy();

    const value0 = value.valueAt('a');
    expect(value0 instanceof MIRegisterSimpleValue).toBeTruthy();
    invariant(value0 instanceof MIRegisterSimpleValue);
    expect(value0.value).toBe('0xc3');

    const value1 = value.valueAt('b');
    expect(value1 instanceof MIRegisterSimpleValue).toBeTruthy();
    invariant(value1 instanceof MIRegisterSimpleValue);
    expect(value1.value).toBe('0xf5');
  });

  it('should parse a nested structure', () => {
    const textValue = '{a = {0xc3, 0xf5}}';
    const parser = new MIRegisterValueParser(textValue);
    const value = parser.parse();

    expect(value instanceof MIRegisterNamedValues).toBeTruthy();
    invariant(value instanceof MIRegisterNamedValues);
    expect(value.names.length).toBe(1);
    expect(value.names.includes('a')).toBeTruthy();

    const valuea = value.valueAt('a');
    expect(valuea instanceof MIRegisterIndexedValues).toBeTruthy();
    invariant(valuea instanceof MIRegisterIndexedValues);
    expect(valuea.length).toBe(2);

    const value0 = valuea.valueAt('0');
    expect(value0 instanceof MIRegisterSimpleValue).toBeTruthy();
    invariant(value0 instanceof MIRegisterSimpleValue);
    expect(value0.value).toBe('0xc3');

    const value1 = valuea.valueAt('1');
    expect(value1 instanceof MIRegisterSimpleValue).toBeTruthy();
    invariant(value1 instanceof MIRegisterSimpleValue);
    expect(value1.value).toBe('0xf5');
  });
});
