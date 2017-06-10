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

/* eslint comma-dangle: [1, always-multiline], prefer-object-spread/prefer-object-spread: 0 */
/* eslint-disable no-console */

const child_process = require('child_process');
const os = require('os');

const eslintGlobUtil = require('eslint/lib/util/glob-util');

// At least one worker, but no more than 6.
const numWorkers = Math.max(Math.min(os.cpus().length - 1, 6), 1);

const files = eslintGlobUtil
  .listFilesToProcess(['**/*.js'])
  .map(f => f.filename);

const chunks = bucketize(files, numWorkers);

// Verify that chunks were actually split correctly:
// require('assert').deepEqual(files, [].concat(...chunks));

let stdOut = '';
let stdErr = '';
let exitCode;

while (chunks.length) {
  const chunk = chunks.shift();
  const ps = child_process.spawn(
    process.execPath,
    [
      '--eval',
      `
      (function retry(retries) {
        try {
          require('./node_modules/.bin/eslint');
        } catch (err) {
          if (--retries && Array.isArray(err) && err[2] instanceof Error) {
            console.error('**ESLint flow-parser mystery v8 bug... retrying**');
            console.error(require('util').inspect(err));
            // Reset the module cache because ESLint is stateful
            Object.keys(require.cache)
              .filter(x => x.includes('/node_modules/'))
              .forEach(x => { delete require.cache[x]; });
            retry(retries);
          } else {
            throw err;
          }
        }
      })(3);
      `,
      '--',
      '',
      '--format', 'codeframe',
      '--max-warnings', '0',
      '--',
      ...chunk,
    ],
    {encoding: 'utf8'}
  )
  .once('exit', code => {
    stdOut += out;
    stdErr += err;
    if (code && exitCode == null) {
      exitCode = code;
    }
  });

  let out = '';
  let err = '';
  ps.stdout.on('data', data => { out += data; });
  ps.stderr.on('data', data => { err += data; });
}

process.once('beforeExit', code => {
  if (!code && exitCode) {
    process.exitCode = exitCode;
    console.error('ESLint exit code %s', exitCode);
  }
  if (stdOut) {
    console.log(stdOut);
  }
  if (stdErr) {
    console.error(stdErr);
  }
});

function bucketize(arr, num) {
  const size = Math.ceil(arr.length / num);
  const result = [];
  let index = 0;
  while (index < arr.length) {
    result.push(arr.slice(index, index += size));
  }
  return result;
}
