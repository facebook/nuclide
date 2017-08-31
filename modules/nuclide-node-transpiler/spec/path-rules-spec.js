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

const path = require('path');
const glob = require('glob');

const pathRules = require('../lib/path-rules');

describe('path-rules', () => {
  describe('pathRules.getIncludedFiles', () => {
    it('works', () => {
      const includedFiles = pathRules.getIncludedFiles();

      expect(includedFiles.includes(__filename)).toBe(true);

      const pathToNodeModulesFile = require.resolve('babel-core');
      expect(!includedFiles.includes(pathToNodeModulesFile)).toBe(true);
    });
  });

  describe('pathRules.isIncluded', () => {
    it('matches what getIncludedFiles finds', () => {
      const expectedFiles = pathRules.getIncludedFiles().sort();
      const allFiles = glob.sync(path.join(__dirname, '../../../**/*.js')).sort();

      expect(expectedFiles).not.toEqual(allFiles);

      for (let i = allFiles.length - 1; i >= 0; i--) {
        if (!pathRules.isIncluded(allFiles[i])) {
          allFiles.splice(i, 1);
        }
      }

      expect(expectedFiles).toEqual(allFiles);
    });
  });
});
