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

const path = require('path');
const {getPackage, isFbOnlyFile} = require('./utils');
const fs = require('fs');

const checkedPackages = new Set();

function createFobidList(dir) {
  const forbid = [];
  try {
    fs.readdirSync(path.join(__dirname, dir)).forEach(p => {
      if (p.startsWith('fb-')) {
        forbid.push(p);
      }
    });
  } catch (e) {
    // This lint rules also runs in the atom-ide-ui repository, which doesn't have a pkg/ folder at the root.
  }

  return forbid;
}

module.exports = function(context) {
  // Forbid fb-* packages in modules and nuclide/pkg.
  const forbidList = new Set(
    createFobidList('../').concat(createFobidList('../../pkg')),
  );

  const file = context.getFilename();
  const dir = path.dirname(file);
  const currentFileIsFbOnly = isFbOnlyFile(file);
  return {
    Program(node) {
      if (checkedPackages.has(dir)) {
        return;
      }
      checkedPackages.add(dir);

      const {configPath, json} = getPackage(dir, true);
      if (json == null || json.dependencies == null) {
        return;
      }

      const containingDir = path
        .dirname(configPath)
        .split(path.sep)
        .pop();
      if (containingDir.startsWith('fb')) {
        return;
      }

      const deps = Object.keys(json.dependencies);
      for (const key of deps) {
        if (forbidList.has(key)) {
          context.report({
            node,
            message: `Can't require fb dependency from non-fb package. This package requires dependency ${key} in ${configPath}`,
          });
        }
      }
    },
    ImportDeclaration(node) {
      // If the current file is an fb- file, then fb-imports are fine.
      if (currentFileIsFbOnly) {
        return;
      }

      if (forbidList.has(node.source.value)) {
        // If this is an @fb-only line in a non-fb file, it's still okay.
        const startLine = node.loc.start.line;
        if (
          context
            .getSourceCode()
            .getAllComments()
            .some(
              comment =>
                comment.type === 'Line' &&
                comment.loc.end.line === startLine &&
                comment.value.indexOf(' @fb-only') !== -1,
            )
        ) {
          return;
        }

        // Otherwise this is a bad import.
        context.report({
          node,
          message: `Don't import fb-only file ${
            node.source.value
          } from a non-fb package/file. This would break on OSS builds!`,
        });
      }
    },
  };
};
