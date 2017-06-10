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

module.exports = {
  foo: 5,
  bar(arg: Type): RetType {
    return this.baz(arg);
  },
  baz: (arg: Type): RetType => {},
  asdf: function(arg) {},
  jkl: function jkl(arg) {},
  asdfjkl(arg) {},
  thing,
  stuff: stuff,
};

// We should not render these
module.notexports = {};
notmodule.exports = {};

export default class {}
