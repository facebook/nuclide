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

const path = require('path');

const basedir = path.join(__dirname, '../../..');

const ignorePatterns = [
  '**/node_modules/**',
  '**/VendorLib/**',
];
// ^--v These need to be kept in sync.
const ignoreRe = new RegExp(
  String.raw`/(node_modules|VendorLib)/`
);

module.exports = {
  /**
   * @param ?string directory
   *        An optional [absolute] directory to list files from.
   */
  getIncludedFiles(directory) {
    const cwd = directory || basedir;
    const glob = require('glob');
    // Do not use `basedir + '**/*.js'`, otherwise we risk ignoring ourselves
    // if a parent directory matches an ignore pattern.
    const files = glob.sync('**/*.js', {
      cwd,
      ignore: ignorePatterns,
    }).map(x => path.join(cwd, x));
    return files;
  },
  isIncluded(filename) {
    const [, name] = filename.split(basedir);
    if (name == null || !name.startsWith(path.sep)) {
      // This file falls outside of the Nuclide directory, or
      // it's a directory that has the same prefix as the Nuclide directory.
      return false;
    }
    return !ignoreRe.test(name);
  },
};
