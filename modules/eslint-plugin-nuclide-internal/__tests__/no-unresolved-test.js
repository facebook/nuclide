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

const rule = require('../no-unresolved');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester({
  parser: 'babel-eslint',
});

ruleTester.run('no-unresolved', rule, {
  valid: [
    {code: 'var path = require("path")'},
    {code: 'var atom = require("atom")'},
    {code: 'var test = require("./test")'},
    {
      code: 'import type test from "asdfasdf"',
      parserOptions: {sourceType: 'module'},
    },
    {
      code: 'import asdfasdf from "asdfasdf"',
      filename: '/a/spec/test.js',
      parserOptions: {sourceType: 'module'},
    },
  ],
  invalid: [
    {
      code: 'var test = require("unresolvable")',
      errors: [
        {
          message:
            '"unresolvable" must be a dependency in the root package.json',
          type: 'VariableDeclarator',
        },
      ],
    },
  ],
});
