/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 */
'use strict';

/* eslint
  comma-dangle: [1, always-multiline],
  prefer-object-spread/prefer-object-spread: 0,
  nuclide-internal/no-commonjs: 0,
  */
/* eslint-disable no-console */

require('../..');

const assert = require('assert');

assert.doesNotThrow(() => {
  require('./modern-syntax');
});

const ModernSyntax = require('./modern-syntax');
assert.equal(typeof ModernSyntax.Foo, 'function');
assert.equal(ModernSyntax.Foo.bar, 'qux');

const VanillaSyntax = require('./vanilla-syntax');
assert.equal(typeof VanillaSyntax.Foo, 'function');
assert.equal(typeof VanillaSyntax.Foo.bar, 'function');
assert.equal(VanillaSyntax.Foo.bar(), 'qux');

// This may not always be true forever. If the v8 output changes, then remove
// this test.
assert.equal(
  VanillaSyntax.Foo.toString(),
  "class Foo {\n  static bar() {\n    return 'qux';\n  }\n}"
);
// The transpiled version of "Foo" would've looked like this:
assert.notEqual(
  VanillaSyntax.Foo.toString(),
  'function Foo() {\n    _classCallCheck(this, Foo);\n  }'
);

console.log('OK');
