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

const rule = require('../require-universal-disposable');
const RuleTester = require('eslint').RuleTester;
const ruleTester = new RuleTester();
const ERROR = 'Incorrect Disposable Used (must use UniversalDisposable)';

ruleTester.run('require-universal-disposable', rule, {
  valid: [
    {
      code: 'new UniversalDisposable()',
    },
  ],
  invalid: [
    {
      code: 'new Disposable()',
      errors: [ERROR],
    },
    {
      code: 'new CompositeDisposable()',
      errors: [ERROR],
    },
  ],
});
