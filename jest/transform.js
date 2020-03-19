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

const NodeTranspiler = require('nuclide-node-transpiler/lib/NodeTranspiler');
const transpiler = new NodeTranspiler();
const crypto = require('crypto');
const fs = require('fs');

const cacheKeyBase = fs.readFileSync(__filename);

module.exports = {
  process(src, path) {
    return NodeTranspiler.shouldCompile(src)
      ? transpiler.transform(src, path)
      : src;
  },

  getCacheKey(script, file, configString, options) {
    const instrument = options.instrument;
    return crypto
      .createHash('md5')
      .update(transpiler.getConfigDigest())
      .update('\0' + cacheKeyBase)
      .update('\0' + script + file + configString)
      .update(instrument ? '\0instrument' : '')
      .digest('hex');
  },
};
