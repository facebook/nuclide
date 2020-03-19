/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @noflow
 * @format
 */

/* eslint-disable */

export class Foo {
  field: Type;

  bar(arg: Type): RetType {
    return this.baz(arg);
  }

  baz = (arg: Type): RetType => {};

  foo(arg: Foo = new Foo()) {}
}
