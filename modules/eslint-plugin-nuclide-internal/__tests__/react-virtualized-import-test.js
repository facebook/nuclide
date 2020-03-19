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

const rule = require('../react-virtualized-import');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester({
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module',
  },
});

ruleTester.run('react-virtualized-import', rule, {
  valid: [
    {code: 'import ReactVirtualized from "react-virtualized";'},
    {code: 'import * as ReactVirtualized from "react-virtualized";'},
  ],
  invalid: [
    {
      code: 'import {AutoSizer} from "react-virtualized";',
      errors: [
        {
          message:
            "Do not import from 'react-virtualized' for performance" +
            " reasons. Import 'react-virtualized/dist/commonjs/AutoSizer'" +
            ' instead.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import {List} from "react-virtualized";',
      errors: [
        {
          message:
            "Do not import from 'react-virtualized' for performance" +
            " reasons. Import 'react-virtualized/dist/commonjs/List'" +
            ' instead.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import {AutoSizer, List} from "react-virtualized";',
      errors: [
        {
          message:
            "Do not import from 'react-virtualized' for performance" +
            " reasons. Import 'react-virtualized/dist/commonjs/AutoSizer'" +
            ' instead.',
          type: 'ImportDeclaration',
        },
        {
          message:
            "Do not import from 'react-virtualized' for performance" +
            " reasons. Import 'react-virtualized/dist/commonjs/List'" +
            ' instead.',
          type: 'ImportDeclaration',
        },
      ],
    },
  ],
});
