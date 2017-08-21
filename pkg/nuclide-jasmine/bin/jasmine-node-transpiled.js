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

// Forwards the arguments from this script to ./run-jasmine-tests and runs it
// under a timeout. This is used to help find tests that are not terminating
// on their own.

const child_process = require('child_process');

const TIMEOUT_IN_MILLIS = 5 * 60 * 1000;

const args = [
  require.resolve('./run-jasmine-tests'),
  '--forceexit',
  '--captureExceptions',
].concat(
  process.argv.slice(2)
);

const cmd = ['cd', process.cwd(), '&& node'].concat(args).join(' ');

const timeoutId = setTimeout(() => {
  console.error('TEST TIMED OUT when running: %s', cmd);
  process.abort();
}, TIMEOUT_IN_MILLIS);

// Use "inherit" for "stdio" so jasmine-node inherits our TTY, and can properly
// determine whether to show colors or not.
child_process
  .spawn('node', args, {stdio: 'inherit'})
  .on('close', code => {
    clearTimeout(timeoutId);
    if (code === 0) {
      console.log('TEST PASSED when running: %s', cmd);
    } else {
      console.error('TEST FAILED (exit code: %s) when running: %s', code, cmd);
    }
    process.exit(code);
  })
  .on('error', err => {
    console.error('TEST FAILED when running: %s', cmd);
    console.error(err.toString());
    process.exit(1);
  });

