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

const rule = require('../api-spelling');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester({
  parser: 'babel-eslint',
});

ruleTester.run('api-spelling', rule, {
  valid: [
    {code: 'value.isInitialized'},
    {code: 'value.initialize()'},
    {code: 'function initialize() {}'},

    {code: 'value.canceled'},
    {code: 'value.cancel()'},
    {code: 'const WAS_CANCELED_BEFORE = false;'},
    {code: 'function isCanceled() {}'},
    {code: 'class K { isCanceled() {} }'},
    {code: '<Button canceled={true} />'},
  ],
  invalid: [
    {
      code: 'value.isInitialised',
      errors: [
        {
          message:
            'Inconsistent Spelling: Use "Initialize" instead of "Initialise"',
        },
      ],
    },
    {
      code: 'value.initialise()',
      errors: [
        {
          message:
            'Inconsistent Spelling: Use "initialize" instead of "initialise"',
        },
      ],
    },
    {
      code: 'function initialise() {}',
      errors: [
        {
          message:
            'Inconsistent Spelling: Use "initialize" instead of "initialise"',
        },
      ],
    },

    {
      code: 'value.cancelled',
      errors: [
        {
          message:
            'Inconsistent Spelling: Use "canceled" instead of "cancelled"',
        },
      ],
    },
    {
      code: 'const WAS_CANCELLED_BEFORE = false;',
      errors: [
        {
          message:
            'Inconsistent Spelling: Use "CANCELED" instead of "CANCELLED"',
        },
      ],
    },
    {
      code: 'class K { isCancelled() {} }',
      errors: [
        {
          message:
            'Inconsistent Spelling: Use "Canceled" instead of "Cancelled"',
        },
      ],
    },
    {
      code: '<Button cancelled={true} />',
      errors: [
        {
          message:
            'Inconsistent Spelling: Use "canceled" instead of "cancelled"',
        },
      ],
    },
  ],
});
