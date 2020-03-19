/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 */
// license header above without @format
// eslint-disable-next-line
const A_CONSTANT = 42;
const SOME_OTHER_CONSTANT = 24;

// eslint-disable-next-line
const A_MULTILINE_CONST = `
  hey look I span
    multiple
      lines
`;

type Something = {
  name: string,
  age?: number,
};

export function aSingleLineFunctionSignature() {
  return A_CONSTANT + SOME_OTHER_CONSTANT;
}

export function aMultiLineFunctionSignature(
  aReallyReallyLongArgumentNameThatWouldRequireThisToBreakAcrossMultipleLines: Something,
): number {
  return 97;
}

  export function aPoorlyIndentedFunction(
aReallyReallyLongArgumentNameThatWouldRequireThisToBreakAcrossMultipleLines: Something,
): number {
  return 97;
}

type SomethingComplex = {
  properties: {
    name: string,
    age?: number,
  },
};

const foo: ?SomethingComplex = null;
foo;
