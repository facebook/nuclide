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

const rule = require('../jsx-simple-callback-refs');
const RuleTester = require('eslint').RuleTester;

const ERROR_MESSAGE =
  'Callback refs must be either methods or arrow functions with simple assignments.';

const ruleTester = new RuleTester({
  parser: 'babel-eslint',
});

ruleTester.run('jsx-simple-callback-refs', rule, {
  valid: [
    {code: '<a ref="x" />'},
    {code: '<a ref={el => { this._x = el; }} />'},
    {code: '<a ref={(el) => { this._x = el; }} />'},
    {code: '<a ref={el => this._x = el} />'},
    {code: '<a ref={(el) => this._x = el} />'},
    {code: '<a ref={el => (this._x = el)} />'},
    {code: '<a ref={(el) => (this._x = el)} />'},
    {code: '<a ref={this._handleEl} />'},
  ],
  invalid: [
    {
      code: '<a ref={f} />',
      errors: [{message: ERROR_MESSAGE}],
    },
    {
      code: '<a ref={el => f(el)} />',
      errors: [{message: ERROR_MESSAGE}],
    },
    {
      code: '<a ref={el => { if (el) {} }} />',
      errors: [{message: ERROR_MESSAGE}],
    },
    {
      code: '<a ref={el => this.f(el)} />',
      errors: [{message: ERROR_MESSAGE}],
    },
  ],
});
