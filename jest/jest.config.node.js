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
const p = nuclidePath => path.resolve(__dirname, '..', nuclidePath);

module.exports = {
  displayName: 'node',
  rootDir: p(''),
  roots: [p('')],
  testMatch: ['**/__tests__/**/*.js?(x)'],
  transform: {
    '\\.js$': p('jest/transform.js'),
  },
  setupTestFrameworkScriptFile: p('jest/setupTestFrameworkScriptFile.node.js'),
  setupFiles: [p('jest/setup.js')],
  testRunner: require.resolve('jest-circus/runner'),
  moduleNameMapper: {
    electron: p('jest/__mocks__/emptyObject.js'),
  },
  testPathIgnorePatterns: ['/node_modules/'],
  reporters: require('./reporters.config'),
  forceExit: true,
};
