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

let total = 0;

function increment() {
  ++total;
}

function getTotal(): number {
  return total;
}

function product(...factors: Array<number>): number {
  return factors.reduce((prev: number, current: number) => prev * current, 1);
}

function asyncFetch(): Promise<any> {
  return Promise.resolve({
    ignoredByJsonSerialization: undefined,
    shouldShowUpInJsonSerialization: null,
  });
}

module.exports = {
  asyncFetch,
  getTotal,
  increment,
  product,
};
