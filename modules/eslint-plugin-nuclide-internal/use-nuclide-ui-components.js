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
 * This rule forbids instantiating native DOM elements such as <button /> with special classnames
 * provided by Atom. All Nuclide UI should be built using nuclide-ui components whenever possible.
 * This makes it much easier to ensure a consistent, theme-compatible UI and simplifies upgrades.
 *
 */

module.exports = function(context) {
  return {
    JSXIdentifier(node) {
      if (node.name === 'button') {
        context.report({
          node,
          message:
            'Prefer using `<Button />` from nuclide-commons-ui over home-built `<button />`s',
        });
      }
    },
  };
};
