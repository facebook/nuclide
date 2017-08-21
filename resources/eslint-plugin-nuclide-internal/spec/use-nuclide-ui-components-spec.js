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

const rule = require('../use-nuclide-ui-components');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester({
  parser: 'babel-eslint',
});

ruleTester.run('use-nuclide-ui-components', rule, {
  valid: [
    {code: 'var good = <Button className="foo" />;'},
  ],
  invalid: [
    {
      code: 'var bad = <button className="foo" />;',
      errors: [{
        message: 'Prefer using `<Button />` from nuclide-commons-ui over home-built `<button />`s',
        type: 'JSXIdentifier',
      }],
    },
  ],
});
