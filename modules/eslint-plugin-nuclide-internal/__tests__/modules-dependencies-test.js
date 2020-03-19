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

const path = require('path');

const rule = require('../modules-dependencies');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester({
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module',
  },
});

// This actually ends up checking the root package.json, but that's OK.
const TEST_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'modules',
  'test',
  'index.js',
);
// eslint-disable-next-line nuclide-internal/modules-dependencies
const PKG_NAME = require('../../../package.json').name;

ruleTester.run('modules-dependencies', rule, {
  valid: [
    {
      code: 'require("atom");',
      filename: TEST_PATH,
    },
    {
      code: 'require("assert");',
      filename: TEST_PATH,
    },
    {
      code: 'require("./test");',
      filename: TEST_PATH,
    },
    {
      code: 'require("../test");',
      filename: TEST_PATH,
    },
    {
      code: 'import type {test} from "test1234"',
      filename: TEST_PATH,
    },
    {
      code: 'import typeof * as test from "test1234"',
      filename: TEST_PATH,
    },
    {
      code: 'export type {test} from "test1234"',
      filename: TEST_PATH,
    },
  ],
  invalid: [
    {
      code: 'require("test1234");',
      filename: TEST_PATH,
      errors: [
        {
          message: `Dependency "test1234" must be declared in the package.json of module "${PKG_NAME}".`,
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require.resolve("test1234");',
      filename: TEST_PATH,
      errors: [
        {
          message: `Dependency "test1234" must be declared in the package.json of module "${PKG_NAME}".`,
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'import {test} from "test1234/test"',
      filename: TEST_PATH,
      errors: [
        {
          message: `Dependency "test1234" must be declared in the package.json of module "${PKG_NAME}".`,
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import {test} from "../test2"',
      filename: TEST_PATH,
      errors: [
        {
          message: 'modules/ cannot have external relative dependencies.',
          type: 'ImportDeclaration',
        },
      ],
    },
  ],
});
