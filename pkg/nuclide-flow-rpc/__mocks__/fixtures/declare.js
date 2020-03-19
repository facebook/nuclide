/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */
/* eslint-disable */

declare function foo(a: number): string;
declare var PI: number;
declare class Path {
  someString: string;
  toString(): string;
  otherMethod(input: string): number;
}
declare module 'some-es-module' {
  declare class Path {
    toString(): string;
  }
}
