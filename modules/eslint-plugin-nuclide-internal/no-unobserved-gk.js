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

function resolveValueInScope(node, scope) {
  if (node.type === 'Literal') {
    return node.value;
  }
  if (node.type === 'Identifier') {
    const refs = scope.references;
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (ref.identifier.name === node.name) {
        if (ref.writeExpr != null) {
          return resolveValueInScope(ref.writeExpr, scope);
        }
      }
    }
  }
  return null;
}

function resolveValue(node, context) {
  if (node.type === 'Literal') {
    return node.value;
  }
  if (node.type === 'Identifier') {
    let scope = context.getScope();
    while (scope != null) {
      const val = resolveValueInScope(node, scope);
      if (val != null) {
        return val;
      }
      scope = scope.upper;
    }
  }
  return null;
}

const gkCheckFuncs = ['passesGK', 'isGkEnabled', 'asyncIsGkEnabled'];
let fbGatekeepers = null;
let fbGatekeepersLoaded = false;

function getFbGatekeepers() {
  if (fbGatekeepersLoaded) {
    return fbGatekeepers;
  }

  try {
    // $FlowFB
    fbGatekeepers = require('../fb-gatekeeper-raw/fb-gatekeeper-list.js'); // eslint-disable-line nuclide-internal/modules-dependencies
  } catch (_) {}

  fbGatekeepersLoaded = true;
  return fbGatekeepers;
}

/**
 * Capture calls to passesGk and ensures the GK is in the list of GKs
 * Nuclide requests values for.
 */
module.exports = function(context) {
  return {
    CallExpression(node) {
      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.property.type === 'Identifier' &&
        gkCheckFuncs.includes(node.callee.property.name)
      ) {
        const arg = resolveValue(node.arguments[0], context);
        if (arg != null) {
          const gks = getFbGatekeepers();
          if (gks != null) {
            const observedGks = gks.SUBSCRIBED_GATEKEEPER_NAMES;
            if (!observedGks.includes(arg)) {
              context.report({
                node,
                message: `Calling ${
                  node.callee.property.name
                } with a value that is not in fb-Gatekeepers (${arg})`,
              });
            }
          }
        }
      }
    },
  };
};
