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

const rule = require('../disallowed-modules');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester({
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module',
  },
});

ruleTester.run('disallowed-modules', rule, {
  valid: [{code: "import invariant from 'assert'"}],
  invalid: [
    {
      code: "import invariant from 'invariant'",
      errors: [
        {
          message: 'Use "assert" instead of "invariant"',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: "import shellQuote from 'shell-quote'",
      errors: [
        {
          message:
            'Use shellQuote and shellParse from nuclide-commons/string instead of "shell-quote"',
          type: 'ImportDeclaration',
        },
      ],
    },
  ],
});
