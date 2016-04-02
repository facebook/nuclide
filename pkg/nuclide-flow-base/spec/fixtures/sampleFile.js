'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

export type Type = {};
export type RetType = {};

// Update `ast.json` with `flow ast < sampleFile.js > ast.json`
export class Foo {
  field: Type;
  
  bar(arg: Type): RetType {
    return baz(arg);
  }

  baz = (arg: Type): RetType => {};
}

function baz(arg: ?Type, a: any): RetType {
  return {};
}

describe('foo', () => {
  const x = 5;
  it('should work', () => {
    describe('not displaying this', () => x);
  });
});

describe('bar', function() {
  it('should work with a normal function', function() {
  });
});

it('should not display this', () => {});
