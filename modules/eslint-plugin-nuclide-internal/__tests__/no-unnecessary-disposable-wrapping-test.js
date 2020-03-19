/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 * @emails oncall+nuclide
 * @format
 */
'use strict';

/* eslint nuclide-internal/no-commonjs: 0 */

const rule = require('../no-unnecessary-disposable-wrapping');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester();
const ERROR = 'Unnecessary Disposable wrapping';

ruleTester.run('no-unnecessary-disposable-wrapping', rule, {
  valid: [{code: 'new UniversalDisposable(x)'}],
  invalid: [
    {
      code: 'new UniversalDisposable(x, new UniversalDisposable(y))',
      output: 'new UniversalDisposable(x, y)',
      errors: [ERROR],
    },
    {
      code: 'new UniversalDisposable(x, new UniversalDisposable(y, z))',
      output: 'new UniversalDisposable(x, y, z)',
      errors: [ERROR],
    },
    {
      code: 'new UniversalDisposable(x, new Disposable())',
      errors: [ERROR],
    },
    {
      code: 'new UniversalDisposable(x, new UniversalDisposable())',
      errors: [ERROR],
    },
    {
      code:
        'new UniversalDisposable(new Disposable(), new UniversalDisposable())',
      errors: [ERROR, ERROR],
    },
  ],
});
