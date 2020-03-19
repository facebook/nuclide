/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 * @format
 */
'use strict';

/* eslint nuclide-internal/no-commonjs: 0 */

/**
 * A simple test runner with some additional features:
 * 1. loads nuclide-node-transpiler
 * 2. cleans up tempfiles on exit
 *
 * Note that this does *not* load "atomConfig" settings from package.json files.
 * Tests will have to mock out Atom configs if they rely on these.
 */

// eslint-disable-next-line nuclide-internal/modules-dependencies
require('nuclide-node-transpiler');

// Patch Atom's console to output to stdio.
// eslint-disable-next-line nuclide-internal/modules-dependencies
const patchAtomConsole = require('nuclide-commons/patch-atom-console');
patchAtomConsole();

module.exports = function(params) {
  return params.legacyTestRunner(params).then(statusCode => {
    return new Promise(resolve => {
      const temp = require('temp');
      if (statusCode === 0) {
        // eslint-disable-next-line nuclide-internal/modules-dependencies
        const {writeCoverage} = require('../nuclide-commons/test-helpers');
        writeCoverage();

        // Atom intercepts "process.exit" so we have to do our own manual cleanup.
        temp.cleanup((err, stats) => {
          resolve(statusCode);
          if (err && err.message !== 'not tracking') {
            // eslint-disable-next-line no-console
            console.log('temp.cleanup() failed.', err);
          }
        });
      } else {
        // When the test fails, we keep the temp contents for debugging.
        temp.track(false);
        resolve(statusCode);
      }
    });
  });
};
