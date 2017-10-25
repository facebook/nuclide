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

/**
 * A simple test runner with some additional features:
 * 1. loads nuclide-node-transpiler
 * 2. cleans up tempfiles on exit
 *
 * Note that this does *not* load "atomConfig" settings from package.json files.
 * Tests will have to mock out Atom configs if they rely on these.
 */

// TODO(#21523621): Use a regular require once Yarn workspaces are enforced
// eslint-disable-next-line rulesdir/modules-dependencies
require('../nuclide-node-transpiler');

// Patch `console` to output through the main process.
const {Console} = require('console');
const {ipcRenderer} = require('electron');
global.console = new Console(
  /* stdout */ {
    write(chunk) {
      ipcRenderer.send('write-to-stdout', chunk);
    },
  },
  /* stderr */ {
    write(chunk) {
      ipcRenderer.send('write-to-stderr', chunk);
    },
  }
);

module.exports = function(params) {
  return params.legacyTestRunner(params)
    .then(statusCode => {
      return new Promise(resolve => {
        const temp = require('temp');
        if (statusCode === 0) {
          // eslint-disable-next-line rulesdir/modules-dependencies
          const {writeCoverage} = require('../nuclide-commons/test-helpers');
          writeCoverage();

          // Atom intercepts "process.exit" so we have to do our own manual cleanup.
          temp.cleanup((err, stats) => {
            resolve(statusCode);
            if (err && err.message !== 'not tracking') {
              // eslint-disable-next-line no-console
              console.log(`temp.cleanup() failed. ${err}`);
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
