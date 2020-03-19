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

const {Console} = require('console');

/**
 * This should only be used in Atom test contexts!
 * Atom tests normally only display console output in the renderer devtools,
 * which makes debugging difficult in headless mode.
 * This overwrites global.console with a patched console that writes to both
 * the devtools and regular stdio.
 */
module.exports = function patchAtomConsole() {
  const mainConsole = new Console(process.stdout, process.stderr);
  const rendererConsole = global.console;
  const mergedConsole = {};
  Object.getOwnPropertyNames(rendererConsole)
    .filter(prop => typeof rendererConsole[prop] === 'function')
    .forEach(prop => {
      mergedConsole[prop] =
        typeof mainConsole[prop] === 'function'
          ? (...args) => {
              mainConsole[prop](...args);
              return rendererConsole[prop](...args);
            }
          : (...args) => rendererConsole[prop](...args);
    });
  global.console = mergedConsole;
};
