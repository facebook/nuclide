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

const rule = require('../license-header');
const RuleTester = require('eslint').RuleTester;

const {
  FLOW_FORMAT_AND_TRANSPILE,
  NO_FLOW_AND_NO_TRANSPILE,
} = rule;

const SHEBANG = '#!/usr/bin/env node';
const LINE = '';
const CODE = 'module.exports = {};';
const DOCBLOCK = '/* docblock */';
const USE_BABEL = "'use babel';";

const LICENSE_ERROR = 'Expected a license header';

const ruleTester = new RuleTester({
  parser: 'babel-eslint',
});

ruleTester.run('license-header', rule, {
  valid: [
    {code: [FLOW_FORMAT_AND_TRANSPILE].join('\n')},
    {code: [FLOW_FORMAT_AND_TRANSPILE, LINE].join('\n')},
    {code: [FLOW_FORMAT_AND_TRANSPILE, LINE, CODE].join('\n')},

    {code: [NO_FLOW_AND_NO_TRANSPILE].join('\n')},
    {code: [NO_FLOW_AND_NO_TRANSPILE, LINE].join('\n')},
    {code: [NO_FLOW_AND_NO_TRANSPILE, LINE, CODE].join('\n')},

    {code: [SHEBANG, NO_FLOW_AND_NO_TRANSPILE].join('\n')},
    {code: [SHEBANG, NO_FLOW_AND_NO_TRANSPILE, LINE].join('\n')},
    {code: [SHEBANG, NO_FLOW_AND_NO_TRANSPILE, LINE, CODE].join('\n')},
  ],
  invalid: [
    {
      code: [SHEBANG, FLOW_FORMAT_AND_TRANSPILE].join('\n'),
      errors: [LICENSE_ERROR],
    },
    {
      code: [USE_BABEL, FLOW_FORMAT_AND_TRANSPILE].join('\n'),
      errors: [LICENSE_ERROR],
    },
    {
      code: [SHEBANG].join('\n'),
      errors: [LICENSE_ERROR],
    },
    {
      code: [SHEBANG, LINE].join('\n'),
      errors: [LICENSE_ERROR],
      output: [SHEBANG, LINE].join('\n'),
    },
    {
      code: [CODE, LINE].join('\n'),
      errors: [LICENSE_ERROR],
      output: FLOW_FORMAT_AND_TRANSPILE + CODE + '\n',
    },
    {
      code: ['/* @flow */', CODE, LINE].join('\n'),
      errors: [LICENSE_ERROR],
      output: [FLOW_FORMAT_AND_TRANSPILE.trim(), CODE, LINE].join('\n'),
    },
    {
      code: ['/* @noflow */', CODE, LINE].join('\n'),
      errors: [LICENSE_ERROR],
      output: [NO_FLOW_AND_NO_TRANSPILE.trim(), CODE, LINE].join('\n'),
    },
    {
      code: [DOCBLOCK, CODE, LINE].join('\n'),
      errors: [LICENSE_ERROR],
      output: [FLOW_FORMAT_AND_TRANSPILE.trim(), DOCBLOCK, CODE, LINE].join('\n'),
    },
  ],
});
