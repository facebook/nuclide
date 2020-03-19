/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @noflow
 * @format
 */
'use strict';

/* eslint nuclide-internal/no-commonjs: 0 */

const path = require('path');

module.exports = {
  jestBin: path.resolve(__dirname, 'node_modules/.bin/jest'),
  jestConfig: path.resolve(__dirname, 'jest.config.js'),
  nodeBin: path.resolve(__dirname, '../js/scripts/node/node'),
  rootDir: __dirname,
  testRegex: '__(atom_)?tests__\\/.*\\.js$',
  env: {JEST_ENVIRONMENT: 'nuclide:nuclide-test-runner'},
};
