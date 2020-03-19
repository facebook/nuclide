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

const rule = require('../no-commonjs');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester({
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module',
  },
});

ruleTester.run('no-commonjs', rule, {
  valid: [
    {code: 'var path = require(__dirname + "path")'},
    {code: 'createPackage(module.exports, Activation)'},
  ],
  invalid: [
    {
      code: "var path = require('path')",
      errors: [
        {
          message: 'Use "import" instead of "require"',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'module.exports = {}',
      errors: [
        {
          message: 'Use "export" instead of "module.exports"',
          type: 'AssignmentExpression',
        },
      ],
    },
    {
      code: 'module.exports.dog = {}',
      errors: [
        {
          message: 'Use "export" instead of "module.exports"',
          type: 'AssignmentExpression',
        },
      ],
    },
  ],
});
