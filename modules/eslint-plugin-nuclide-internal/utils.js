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

const fs = require('fs');
const path = require('path');

const ATOM_BUILTIN_PACKAGES = new Set(['atom', 'electron', 'remote']);

function getPackage(startPath, getPath = false) {
  let current = path.resolve(startPath);
  while (true) {
    const filename = path.join(current, 'package.json');
    try {
      const source = fs.readFileSync(filename, 'utf8');
      const json = JSON.parse(source);
      json.__filename = filename;
      json.__dirname = current;
      return getPath ? {configPath: filename, json} : json;
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

function isRequireResolve(node) {
  return (
    node &&
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'require' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'resolve' &&
    node.arguments[0] &&
    node.arguments[0].type === 'Literal'
  );
}

function isFbOnlyFile(filePath) {
  return (
    filePath
      .split(path.sep)
      .find(part => part.startsWith('fb-') || part === 'fb') != null
  );
}

module.exports = {
  ATOM_BUILTIN_PACKAGES,
  getPackage,
  isRequire,
  isRequireResolve,
  isFbOnlyFile,
};
