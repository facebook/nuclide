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

module.exports = {
  rootDir: '../..',
  filter: '<rootDir>/xplat/js/jest/filter.js',
  projects: [
    '<rootDir>/xplat/nuclide/jest/jest.config.atom.js',
    '<rootDir>/xplat/nuclide/jest/jest.config.node.js',
  ],
  testFailureExitCode: 0,
  reporters: require('./jest/reporters.config'),
  forceExit: true,
};
