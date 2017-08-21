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

const rule = require('../consistent-import-name');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester();

ruleTester.run('consistent-import-name', rule, {
  valid: [
    {code: 'var path = require("path")'},
    {code: 'var pathModule = require("path")'},
    {code: 'require("path")'},
    {code: 'var whateverModule = require("whateverModule")'},
    {
      code: 'import "path"',
      parserOptions: {sourceType: 'module'},
    },
    {
      code: 'import pathModule from "path"',
      parserOptions: {sourceType: 'module'},
    },
    {
      code: 'import * as path from "path"', // used as "import typeof"
      parserOptions: {sourceType: 'module'},
    },
  ],
  invalid: [
    {
      code: 'var pathUtils = require("path")',
      errors: [{
        message: 'path should be named "path" or "pathModule"',
        type: 'Identifier',
      }],
    },
    {
      code: 'var {path} = require("path")',
      parserOptions: {ecmaVersion: 7},
      errors: [{
        message: 'path should be named "path" or "pathModule"',
        type: 'ObjectPattern',
      }],
    },
    {
      code: 'import pathUtils from "path"',
      parserOptions: {sourceType: 'module'},
      errors: [{
        message: 'path should be named "path" or "pathModule"',
        type: 'ImportDefaultSpecifier',
      }],
    },
    {
      code: 'import * as pathUtils from "path"',
      parserOptions: {sourceType: 'module'},
      errors: [{
        message: 'path should be named "path" or "pathModule"',
        type: 'ImportNamespaceSpecifier',
      }],
    },
    {
      code: 'import {path} from "path"',
      parserOptions: {sourceType: 'module'},
      errors: [{
        message: 'path should be named "path" or "pathModule"',
        type: 'ImportSpecifier',
      }],
    },
    {
      code: 'import pathModule, {path} from "path"',
      parserOptions: {sourceType: 'module'},
      errors: [{
        message: 'path should be named "path" or "pathModule"',
        type: 'ImportSpecifier',
      }],
    },
    {
      code: 'import pathUtils, {path} from "path"',
      parserOptions: {sourceType: 'module'},
      errors: [{
        message: 'path should be named "path" or "pathModule"',
        type: 'ImportDefaultSpecifier',
      }, {
        message: 'path should be named "path" or "pathModule"',
        type: 'ImportSpecifier',
      }],
    },
  ],
});
