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
  nuclide-internal/no-commonjs: 0,
  */

/**
 * This file installs the logic that modifies Node's built in require()
 * function to transpile .js files that have the @flow pragma.
 */

const Module = require('module');
const fs = require('fs');

const builtinJsExt = Module._extensions['.js'];

const NodeTranspiler = require('./NodeTranspiler');
const nodeTranspiler = new NodeTranspiler();
const pathRules = require('./path-rules');

let transpiling = null;

function transpiler_require_hook(_module, filename) {
  let moduleExports;
  if (pathRules.isIncluded(filename)) {
    // Keep src as a buffer so calculating its digest with crypto is fast.
    const src = fs.readFileSync(filename);
    let output;
    if (NodeTranspiler.shouldCompile(src)) {
      if (transpiling != null) {
        // This means that the transpiler tried to transpile itself.
        throw new Error(`Circular transpile from "${transpiling}" to "${filename}"`);
      }
      try {
        transpiling = filename;
        output = nodeTranspiler.transformWithCache(src, filename);
      } catch (err) {
        throw err;
      } finally {
        transpiling = null;
      }
    } else {
      output = src.toString();
    }
    moduleExports = _module._compile(output, filename);
  } else {
    moduleExports = builtinJsExt(_module, filename);
  }
  return moduleExports;
}

/**
 * Atom sets `require.extensions['.js']` as not writable (maybe to prevent
 * sloppy code from attaching a require hook that doesn't filter by path?). To
 * workaround that, we create a new `Module._extensions` object instead, with
 * our custom hook. Keeping the iteration order of this object is really
 * important because it determines the file extension lookup priority.
 */
Module._extensions = Object.keys(Module._extensions).reduce((acc, ext) => {
  const desc = Object.getOwnPropertyDescriptor(Module._extensions, ext);
  if (ext === '.js') {
    desc.value = transpiler_require_hook;
  }
  Object.defineProperty(acc, ext, desc);
  return acc;
}, {});
