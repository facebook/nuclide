#!/usr/bin/env node
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
/* eslint-disable no-console */

// jasmine-node test runner with Atom test globals and babel transpiling support.

const {__DEV__} = require('../../nuclide-node-transpiler/lib/env');

if (__DEV__) {
  require('../../nuclide-node-transpiler');
}

// Set this up before we call jasmine-node. jasmine-node does this same trick,
// but neglects to respect the exit code, so we beat it the to the punch.
process.once('exit', code => {
  const temp = require('temp');
  if (code === 0) {
    // jasmine-node is swallowing temp's exit handler, so force a cleanup.
    try {
      temp.cleanupSync();
    } catch (err) {
      if (err && err.message !== 'not tracking') {
        console.log(`temp.cleanup() failed. ${err}`);
      }
    }
  } else {
    // When the test fails, we keep the temp contents for debugging.
    temp.track(false);
  }
  process.exit(code);
});

// Load waitsForPromise into global.
global.waitsForPromise = require('../lib/waitsForPromise').default;
global.window = global;

require('../lib/focused');
require('../lib/unspy');
require('../lib/faketimer');

try {
  // This loads the CLI for jasmine-node.
  require('jasmine-node/bin/jasmine-node');
} catch (e) {
  // Note that the process.exit(1) works now because of the "exit" handler
  // installed at the start of this script.
  console.error(e.toString());
  console.error(e.stack);

  process.exit(1);
}
