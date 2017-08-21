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

const fs = require('fs');
const path = require('path');

const ATOM_BUILTIN_PACKAGES = new Set([
  'atom',
  'electron',
  'remote',
]);

function getPackage(startPath) {
  let current = path.resolve(startPath);
  while (true) {
    const filename = path.join(current, 'package.json');
    try {
      const source = fs.readFileSync(filename, 'utf8');
      const json = JSON.parse(source);
      json.__filename = filename;
      json.__dirname = current;
      return json;
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
        const next = path.join(current, '..');
        if (next === current) {
          return null;
        } else {
          current = next;
        }
      } else {
        throw err;
      }
    }
  }
}

function isRequire(node) {
  return (
    node &&
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'require' &&
    node.arguments[0] &&
    node.arguments[0].type === 'Literal'
  );
}

module.exports = {
  ATOM_BUILTIN_PACKAGES,
  getPackage,
  isRequire,
};
