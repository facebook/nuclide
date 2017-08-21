/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @noflow
 */
'use strict';

/* eslint
  comma-dangle: [1, always-multiline],
  prefer-object-spread/prefer-object-spread: 0,
  nuclide-internal/no-commonjs: 0,
  */

const rule = require('../no-commonjs');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester();

ruleTester.run('no-commonjs', rule, {
  valid: [
    {code: 'var path = require(__dirname + "path")'},
    {code: 'createPackage(module.exports, Activation)'},
  ],
  invalid: [
    {
      code: "var path = require('path')",
      errors: [{
        message: 'Use "import" instead of "require"',
        type: 'CallExpression',
      }],
    },
    {
      code: 'module.exports = {}',
      errors: [{
        message: 'Use "export" instead of "module.exports"',
        type: 'AssignmentExpression',
      }],
    },
    {
      code: 'module.exports.dog = {}',
      errors: [{
        message: 'Use "export" instead of "module.exports"',
        type: 'AssignmentExpression',
      }],
    },
  ],
});
