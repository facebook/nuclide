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
const resolveFrom = require('resolve-from');

const {isRequire, isFbOnlyFile} = require('./utils');

module.exports = function(context) {
  const filename = context.getFilename();
  const dirname = path.dirname(filename);

  const inFbOnlyFile = isFbOnlyFile(filename);

  function getFbOnlyRequires(node) {
    const id = node.arguments[0].value;
    const resolved = resolveFrom(dirname, id);
    // Exclude modules that are not found.
    if (resolved == null || !isFbOnlyFile(resolved)) {
      return false;
    }
    const startLine = node.loc.start.line;
    const hasFlowFbCommentBefore =
      context
        .getSourceCode()
        .getAllComments()
        .find(comment => {
          return (
            comment.type === 'Line' &&
            comment.loc.end.line === startLine - 1 &&
            comment.value.indexOf(' $FlowFB') !== -1
          );
        }) != null;
    return !hasFlowFbCommentBefore;
  }

  function reportError(node) {
    const message =
      'fb-only requires must have a line comment `// $FlowFB` above';
    context.report({
      node,
      message,
    });
  }

  return {
    CallExpression(node) {
      if (!isRequire(node) || inFbOnlyFile) {
        return;
      }
      const result = getFbOnlyRequires(node);
      if (result) {
        reportError(node);
      }
    },
  };
};
