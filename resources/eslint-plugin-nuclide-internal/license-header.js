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

const path = require('path');

const FAKE_DISABLE_RE = /\s*eslint-disable\s+nuclide-internal\/license-header\s*/;

const SHEBANG_RE = /^#!\/usr\/bin\/env node\n/;

const FLOW_FORMAT_AND_TRANSPILE = `\
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */
`;

const NO_FLOW_AND_NO_TRANSPILE = `\
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
`;

const MODULES_FLOW_FORMAT_AND_TRANSPILE = `\
/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */
`;

const MODULES_NO_FLOW_AND_NO_TRANSPILE = `\
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
`;

module.exports = function(context) {
  // "eslint-disable" disables rules after it. Since the directives have to go
  // first, we can't use that mechanism to disable this check.
  const comments = context.getAllComments();
  for (let i = 0; i < comments.length; i++) {
    if (FAKE_DISABLE_RE.test(comments[i].value)) {
      return {};
    }
  }

  return {
    Program(node) {
      const sourceCode = context.getSourceCode();
      const source = sourceCode.text;

      const isInModules = context
        .getFilename()
        .startsWith(path.join(__dirname, '..', '..', 'modules/'));
      const flowHeader = isInModules
        ? MODULES_FLOW_FORMAT_AND_TRANSPILE
        : FLOW_FORMAT_AND_TRANSPILE;
      if (source.startsWith(flowHeader)) {
        return;
      }

      const noFlowHeader = isInModules
        ? MODULES_NO_FLOW_AND_NO_TRANSPILE
        : NO_FLOW_AND_NO_TRANSPILE;
      if (source.replace(SHEBANG_RE, '').startsWith(noFlowHeader)) {
        return;
      }

      let fix;
      // The modules folder has a special license that shouldn't be blindly applied.
      if (!isInModules) {
        const comment = context.getSourceCode().getAllComments()[0];
        if (
          comment != null &&
          comment.type === 'Block' &&
          comment.loc.start.line === 1
        ) {
          if (comment.value.includes('@flow')) {
            fix = fixer => fixer.replaceText(comment, flowHeader.trim());
          } else if (comment.value.includes('@noflow')) {
            // TODO: replace the stuff after the docblock.
            // It should be pretty obvious to the user, though.
            fix = fixer => fixer.replaceText(comment, noFlowHeader.trim());
          } else {
            // Default to the @flow header.
            fix = fixer => fixer.insertTextBeforeRange([0, 0], flowHeader);
          }
        } else if (!source.match(SHEBANG_RE)) {
          fix = fixer => fixer.insertTextBeforeRange([0, 0], flowHeader);
        }
      }

      context.report({
        node,
        message: 'Expected a license header',
        fix,
      });
    },
  };
};

module.exports.schema = [];
module.exports.FLOW_FORMAT_AND_TRANSPILE = FLOW_FORMAT_AND_TRANSPILE;
module.exports.NO_FLOW_AND_NO_TRANSPILE = NO_FLOW_AND_NO_TRANSPILE;
