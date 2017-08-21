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

//------------------------------------------------------------------------------
// NodeTranspiler is a wrapper around babel with:
//  * Nuclide specific configuration, that must be shared among several
//    independent transpile systems.
//  * Lazy-loading of expensive libs like babel.
//------------------------------------------------------------------------------

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const docblock = require('./docblock');

const BABEL_OPTIONS = {
  parserOpts: {
    plugins: [
      'classProperties',
      'flow',
      'jsx',
      'objectRestSpread',
    ],
  },
  plugins: [
    [require.resolve('./inline-invariant-tr')],
    [require.resolve('./use-minified-libs-tr')],
    [require.resolve('babel-plugin-idx')],

    [require.resolve('babel-plugin-transform-async-to-module-method'), {
      module: 'async-to-generator',
      method: 'default',
    }],
    [require.resolve('babel-plugin-transform-class-properties')],
    [require.resolve('babel-plugin-transform-object-rest-spread'), {useBuiltIns: true}],
    [require.resolve('babel-plugin-transform-strict-mode')],

    // babel-preset-react:
    [require.resolve('babel-plugin-transform-react-jsx'), {useBuiltIns: true}],
    [require.resolve('babel-plugin-transform-flow-strip-types')],
    [require.resolve('babel-plugin-transform-react-display-name')],

    // Toggle these to control inline-imports:
    // [require.resolve('babel-plugin-transform-es2015-modules-commonjs')],
    [require.resolve('babel-plugin-transform-inline-imports-commonjs'), {
      excludeModules: [
        'async-to-generator',
        'atom',
        'electron',
        'react',
        'react-dom',
        'rxjs/bundles/Rx.min.js',
      ],
      excludeNodeBuiltins: true,
    }],
  ],
};

function getVersion(start) {
  let current = start;
  do {
    try {
      const filename = path.join(current, 'package.json');
      const src = fs.readFileSync(filename);
      const json = JSON.parse(src);
      return json.version;
    } catch (err) {
      current = path.join(current, '..');
    }
  } while (current !== path.join(current, '..'));
}

class NodeTranspiler {
  static shouldCompile(bufferOrString) {
    const src = bufferOrString.toString();
    const directives = docblock.parseAsObject(docblock.extract(src));
    return directives.hasOwnProperty('flow');
  }

  constructor() {
    this._babelVersion = require('babel-core/package.json').version;
    this._getBabel = () => require('babel-core');
    this._babel = null;
    this._cacheDir = null;
    this._configDigest = null;
  }

  getConfigDigest() {
    if (!this._configDigest) {
      // Keep the digest consistent regardless of what directory we're in.
      const optsOnly = Object.assign({}, BABEL_OPTIONS, {plugins: null});
      const hash = crypto
        .createHash('sha1')
        .update('babel-core', 'utf8')
        .update('\0', 'utf8')
        .update(this._babelVersion, 'utf8')
        .update('\0', 'utf8')
        .update(JSON.stringify(optsOnly), 'utf8');
      // The source of this file and that of our plugins is used as part of the
      // hash as a way to version our transforms. For external transforms their
      // package.json version is used.
      [__filename, require.resolve('./docblock')]
        .concat(BABEL_OPTIONS.plugins)
        .filter(Boolean)
        .forEach(plugin => {
          const pluginFile = Array.isArray(plugin) ? plugin[0] : plugin;
          if (pluginFile.includes('node_modules')) {
            hash.update(getVersion(pluginFile));
          } else {
            hash.update(fs.readFileSync(pluginFile));
          }
          hash.update('\0', 'utf8');
        });
      this._configDigest = hash.digest('hex');
    }
    return this._configDigest;
  }

  getFileDigest(src, filename) {
    assert(typeof filename === 'string');
    const hash = crypto
      .createHash('sha1')
      // Buffers are fast, but strings work too.
      .update(src, Buffer.isBuffer(src) ? undefined : 'utf8');
    if (BABEL_OPTIONS.sourceMap) {
      // Sourcemaps encode the filename.
      hash
        .update('\0', 'utf8')
        .update(filename, 'utf8');
    }
    const fileDigest = hash.digest('hex');
    return fileDigest;
  }

  transform(src, filename) {
    assert(typeof filename === 'string');
    if (!this._babel) {
      this._babel = this._getBabel();
    }
    try {
      const input = Buffer.isBuffer(src) ? src.toString() : src;
      const opts = BABEL_OPTIONS.sourceMap
        ? Object.assign({filename}, BABEL_OPTIONS)
        : BABEL_OPTIONS;
      const output = this._babel.transform(input, opts).code;
      return output;
    } catch (err) {
      console.error(`Error transpiling "${filename}"`);
      throw err;
    }
  }

  transformWithCache(src, filename) {
    assert(typeof filename === 'string');
    const cacheFilename = this._getCacheFilename(src, filename);

    if (fs.existsSync(cacheFilename)) {
      const cached = fs.readFileSync(cacheFilename, 'utf8');
      return cached;
    }

    const output = this.transform(src, filename);
    this._cacheWriteSync(cacheFilename, output);

    return output;
  }

  _getCacheFilename(src, filename) {
    if (!this._cacheDir) {
      this._cacheDir = path.join(
        os.tmpdir(),
        'nuclide-node-transpiler',
        this.getConfigDigest()
      );
    }
    const fileDigest = this.getFileDigest(src, filename);
    const cacheFilename = path.join(this._cacheDir, fileDigest + '.js');
    return cacheFilename;
  }

  _cacheWriteSync(cacheFilename, src) {
    // Write the file to a temp file first and then move it so the write to the
    // cache is atomic. Although Node is single-threaded, there could be
    // multiple Node processes running simultaneously that are using the cache.

    const mkdirp = require('mkdirp');
    const uuid = require('uuid');

    const basedir = path.dirname(cacheFilename);
    const tmpName = path.join(basedir, '.' + uuid.v4());

    try {
      mkdirp.sync(basedir);
    } catch (err) {
      console.error(`Cache mkdirp failed. ${err}`);
      return;
    }

    try {
      fs.writeFileSync(tmpName, src);
      fs.renameSync(tmpName, cacheFilename);
    } catch (err) {
      console.error(`Cache write failed. ${err}`);
      try { fs.unlinkSync(tmpName); } catch (err_) {}
    }
  }
}

module.exports = NodeTranspiler;
