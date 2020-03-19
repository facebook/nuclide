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

function baz(arg: ?Type, a: any): RetType {
  foo();
  return {};
}

function foo({bar, y}, [b], ...bars): void {
  baz();
}

const funExpr1 = function(param1: string): void {
  funExpr2(true, null);
};

const funExpr2 = (arg1: boolean, arg2: any) => {
  return funExpr1('');
};

const varFoo = '';

var varBar = '';

let varBaz = {
  foo(): any {
    const shouldNotShowUp = '';
    return shouldNotShowUp;
  },
};

const {foo, bar} = {foo: 4, bar: 5};
const [baz] = [1];
