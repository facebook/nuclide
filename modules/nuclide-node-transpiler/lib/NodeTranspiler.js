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

/* eslint-disable no-console */

//------------------------------------------------------------------------------
// NodeTranspiler is a wrapper around babel with:
//  * Nuclide specific configuration, that must be shared among several
//    independent transpile systems.
//  * Lazy-loading of expensive libs like babel.
//  * It can be configured via environment variables:
//     * COVERAGE_DIR enables the "istanbul" transform to track coverage
//     * NUCLIDE_TRANSPILE_ENV should be null | production | production-modules:
//        * inline sourcemaps are disabled in both production environments
//        * "modules/" paths are not rewritten with "production-modules"
//------------------------------------------------------------------------------

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const isBuiltinModule = require('is-builtin-module');
const path = require('path');
const os = require('os');

const docblock = require('./docblock');

const NUCLIDE_ROOT = path.join(__dirname, '..', '..', '..');

const MODULE_ALIASES = {
  redux: 'redux/dist/redux.min.js',
  rxjs: 'rxjs-compat/bundles/rxjs-compat.umd.min.js',
};

const NON_LAZY_MODULES = new Set([
  'atom',
  'electron',
  'react',
  'react-dom',
  'rxjs-compat/bundles/rxjs-compat.umd.min.js',
]);

const BABEL_OPTIONS = {
  plugins: [
    [require.resolve('./inline-invariant-tr')],
    [
      require.resolve('babel-plugin-module-resolver'),
      {
        alias: MODULE_ALIASES,
        cwd: NUCLIDE_ROOT,
      },
    ],
    [require.resolve('babel-plugin-idx')],
    [
      require.resolve('babel-plugin-lodash'),
      {
        // The babel plugin looks for lodash relative to the CWD.
        // This must be the path to the root package.json.
        cwd: NUCLIDE_ROOT,
      },
    ],

    // Note: @babel/plugin-proposal-class-properties doesn't work for us.
    [require.resolve('babel-plugin-transform-class-properties')],
    [
      require.resolve('@babel/plugin-proposal-object-rest-spread'),
      {
        loose: true,
        useBuiltIns: true,
      },
    ],

    // babel-preset-react:
    [require.resolve('@babel/plugin-transform-react-jsx'), {useBuiltIns: true}],
    [require.resolve('@babel/plugin-transform-flow-strip-types')],
    [require.resolve('@babel/plugin-transform-react-display-name')],

    [require.resolve('babel-plugin-relay')],

    [
      require.resolve('@babel/plugin-transform-modules-commonjs'),
      {
        // Determines which imports to lazy-require.
        lazy(moduleName) {
          if (NON_LAZY_MODULES.has(moduleName)) {
            return false;
          }
          return !isBuiltinModule(moduleName);
        },
      },
    ],
    // The modules-commonjs transform only inserts 'use strict' for files with an ES6 import/export.
    [require.resolve('@babel/plugin-transform-strict-mode')],

    // Experimental syntax:
    [require.resolve('@babel/plugin-proposal-nullish-coalescing-operator')],
    [require.resolve('@babel/plugin-proposal-optional-chaining')],
  ],
};

const {COVERAGE_DIR, NUCLIDE_TRANSPILE_ENV} = process.env;
if (COVERAGE_DIR) {
  BABEL_OPTIONS.plugins.push([require.resolve('babel-plugin-istanbul')]);
}
switch (NUCLIDE_TRANSPILE_ENV) {
  case 'production':
    addYarnWorkspacesCompat();
    break;
  case 'production-modules':
    break;
  default:
    // Inline source maps should not be used in production.
    // TODO: Create .map files in production builds.
    BABEL_OPTIONS.sourceMap = 'inline';
    // While Yarn workspaces work fine in development mode,
    // it doesn't hurt to be closer to the final production state.
    addYarnWorkspacesCompat();
    break;
}

/**
 * Nuclide / atom-ide-ui use Yarn workspaces, which is fine for dev mode -
 * but not so much when they're installed via `apm install` (which calls `npm install`).
 * To avoid having to publish all the modules every time, we can instead
 * use the module resolver transform to rewrite them (except when publishing modules.)
 */
function addYarnWorkspacesCompat() {
  try {
    const rootPkgJson = JSON.parse(
      fs.readFileSync(path.join(NUCLIDE_ROOT, 'package.json')),
    );
    if (Array.isArray(rootPkgJson.workspaces)) {
      const glob = require('glob');
      rootPkgJson.workspaces.forEach(workspace => {
        const folders = glob.sync(workspace, {cwd: NUCLIDE_ROOT});
        folders.forEach(folder => {
          if (fs.existsSync(path.join(folder, 'package.json'))) {
            const moduleName = path.basename(folder);
            // Needs to be a relative path to the root CWD above.
            MODULE_ALIASES[moduleName] = './' + folder;
          }
        });
      });
    }
  } catch (err) {
    // It's OK if something doesn't exist above.
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

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
    return (
      directives.hasOwnProperty('flow') ||
      directives.hasOwnProperty('transpile')
    );
  }

  constructor() {
    this._babelVersion = require('@babel/core/package.json').version;
    this._getBabel = () => require('@babel/core');
    this._babel = null;
    this._cacheDir = null;
    this._configDigest = null;
  }

  getConfigDigest() {
    if (!this._configDigest) {
      // Keep the digest consistent regardless of what directory we're in.
      const optsOnly = {...BABEL_OPTIONS, plugins: null};
      const hash = crypto
        .createHash('sha1')
        .update('@babel/core', 'utf8')
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
      .update(src, Buffer.isBuffer(src) ? undefined : 'utf8')
      .update('\0', 'utf8')
      .update(filename, 'utf8');
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
      const opts = {filename, ...BABEL_OPTIONS};
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
      // Give the ability to put the cache directory somewhere discoverable,
      // so debuggers can find the sourcemaps there.
      this._cacheDir = process.env.NUCLIDE_TRANSPILER_CACHE_DIR;
      if (this._cacheDir == null) {
        this._cacheDir = path.join(os.tmpdir(), 'nuclide-node-transpiler');
      }

      const digest = this.getConfigDigest();
      this._cacheDir = path.join(this._cacheDir, digest);
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
      try {
        fs.unlinkSync(tmpName);
      } catch (err_) {}
    }
  }
}

module.exports = NodeTranspiler;
