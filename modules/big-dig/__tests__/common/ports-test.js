/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 * @emails oncall+nuclide
 */
import {parsePorts} from '../../src/common/ports';

describe('parsePorts', () => {
  it('empty ports', () => {
    test('', []);
    test(',', []);
  });

  it('individual ports', () => {
    test('0', [0]);
    test('42', [42]);
    test('42,43', [42, 43]);
    test('   42   ,   43  ', [42, 43]);
  });

  it('positive ranges', () => {
    test('0-1', [0, 1]);
    test('0-4', [0, 1, 2, 3, 4]);
    test('22-25', [22, 23, 24, 25]);
    test('  18-25 ,  9091-9093,  ', [
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      9091,
      9092,
      9093,
    ]);
    test('3141592653589793238462643', [3141592653589793238462643]);
  });

  it('zero-length ranges', () => {
    test('0-0', [0]);
    test('9091-9091', [9091]);
  });

  it('negative ranges', () => {
    test('5-0', [5, 4, 3, 2, 1, 0]);
    test('5-4', [5, 4]);
    test('9093-9091', [9093, 9092, 9091]);
  });

  it('mix of individuals and ranges', () => {
    test('0, 8080-8083, 42, 10000-10001', [
      0,
      8080,
      8081,
      8082,
      8083,
      42,
      10000,
      10001,
    ]);
  });

  it('invalid patterns', () => {
    testError('-42', 'Could not parse ports from: "-42".');
    testError('0--4', 'Could not parse ports from: "0--4".');
    testError('abcd', 'Could not parse ports from: "abcd".');
    testError('NaN', 'Could not parse ports from: "NaN".');
    testError('4.2', 'Could not parse ports from: "4.2".');
    testError('Infinity', 'Could not parse ports from: "Infinity".');
    testError('-Infinity', 'Could not parse ports from: "-Infinity".');
    const shouldParseAsInfinity =
      '314159265358979323846264338327950288419716939937510582097494459' +
      '230781640628620899862803482534211706798214808651328230664709384' +
      '460955058223172535940812848111745028410270193852110555964462294' +
      '895493038196442881097566593344612847564823378678316527120190914' +
      '5648566923460348610454326648213393607260249141273724587006';
    testError(
      shouldParseAsInfinity,
      `${shouldParseAsInfinity} parses to an extrema: Infinity.`,
    );
  });
});

function test(descriptor: string, ports: Array<number>) {
  const iterable = parsePorts(descriptor);
  expect(Array.from(iterable)).toEqual(ports);
}

function testError(descriptor: string, message: string) {
  expect(() => parsePorts(descriptor)).toThrow(message);
}
