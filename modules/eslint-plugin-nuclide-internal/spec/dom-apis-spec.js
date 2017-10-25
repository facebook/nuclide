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
  rulesdir/no-commonjs: 0,
  */

const rule = require('../dom-apis');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester();

const ERROR_MESSAGE =
  'Use the utilities in nuclide-commons-ui/scrollIntoView instead of Element.scrollIntoView() ' +
  'and Element.scrollIntoViewIfNeeded(). See that module for more information.';


ruleTester.run('dom-apis', rule, {
  valid: [
    {code: 'scrollIntoView(el)'},
    {code: 'scrollIntoView(el, true)'},
    {code: 'scrollIntoViewIfNeeded(el)'},
    {code: 'scrollIntoViewIfNeeded(el, false)'},
  ],
  invalid: [
    {
      code: 'el.scrollIntoView()',
      errors: [{
        message: ERROR_MESSAGE,
        type: 'CallExpression',
      }],
    },
    {
      code: 'el.scrollIntoViewIfNeeded()',
      errors: [{
        message: ERROR_MESSAGE,
        type: 'CallExpression',
      }],
    },
    {
      code: 'el.scrollIntoView(true)',
      errors: [{
        message: ERROR_MESSAGE,
        type: 'CallExpression',
      }],
    },
    {
      code: 'el.scrollIntoViewIfNeeded(false)',
      errors: [{
        message: ERROR_MESSAGE,
        type: 'CallExpression',
      }],
    },
    {
      code: 'el.scrollIntoView({behavior: "smooth"})',
      errors: [{
        message: ERROR_MESSAGE,
        type: 'CallExpression',
      }],
    },
  ],
});
