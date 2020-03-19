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

/**
 * Capture calls to `Element.scrollIntoView()` and `Element.scrollIntoViewIfNeeded()`. Ideally we
 * would only capture these on objects of type `Element`.
 */
module.exports = function(context) {
  return {
    CallExpression(node) {
      const isScrollIntoViewCall =
        node.callee.type === 'MemberExpression' &&
        node.callee.property.type === 'Identifier' &&
        (node.callee.property.name === 'scrollIntoView' ||
          node.callee.property.name === 'scrollIntoViewIfNeeded');
      if (!isScrollIntoViewCall) {
        return;
      }
      context.report({node, message: MESSAGE});
    },
  };
};

const MESSAGE =
  'Use the utilities in nuclide-commons-ui/scrollIntoView instead of Element.scrollIntoView() ' +
  'and Element.scrollIntoViewIfNeeded(). See that module for more information.';
