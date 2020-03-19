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

const REPLACEMENTS = new Map([
  ['cancellable', 'cancelable'],
  ['cancelled', 'canceled'],
  ['cancelation', 'cancellation'], // I know. Weird.
  ['initialise', 'initialize'],
]);

module.exports = function(context) {
  function checkIdentifier(node) {
    REPLACEMENTS.forEach((good, bad) => {
      let toReplace;
      let replacement;

      if (node.name.includes(bad)) {
        toReplace = bad;
        replacement = good;
      } else if (node.name.includes(capFirst(bad))) {
        toReplace = capFirst(bad);
        replacement = capFirst(good);
      } else if (node.name.includes(bad.toUpperCase())) {
        toReplace = bad.toUpperCase();
        replacement = good.toUpperCase();
      }

      if (toReplace != null && replacement != null) {
        context.report({
          node,
          message: `Inconsistent Spelling: Use "${replacement}" instead of "${toReplace}"`,
          fix(fixer) {
            return fixer.replaceText(
              node,
              node.name.split(toReplace).join(replacement),
            );
          },
        });
      }
    });
  }

  return {
    Identifier: checkIdentifier,
    JSXIdentifier: checkIdentifier,
  };
};

const capFirst = str => str[0].toUpperCase() + str.slice(1);
