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

const {isRequire} = require('./utils');

/**
 * This rule enforces a naming standard for external modules. Why?
 * 1. It improves the greppability of the code,
 * 2. Reduces cognitive load by limiting identifier ambiguity,
 * 3. In many cases these modules are imported, so this drives the point home
 *    that a named import != destructuring.
 */

const ALLOWED_NAMES_BY_MODULE = {
  // Node builtins
  assert: ['assert', 'invariant'],
  buffer: ['Buffer'],
  child_process: ['child_process'],
  cluster: ['cluster'],
  crypto: ['crypto'],
  dgram: ['dgram'],
  dns: ['dns'],
  domain: ['domain'],
  // flow doesn't like `import EventEmitter from 'EventEmitter';`
  // 'events': ['EventEmitter'],
  fs: ['fs'],
  http: ['http'],
  https: ['https'],
  // 'net': ['net'],
  os: ['os'],
  // "path" is a really common name, so "pathModule" is the collision escape
  // hatch. There is precedent in Node core for "pathModule"
  // https://github.com/nodejs/node/blob/v5.10.1/lib/fs.js#L8
  path: ['path', 'pathModule'],
  punycode: ['punycode'],
  querystring: ['querystring'],
  readline: ['readline'],
  stream: ['Stream'],
  string_decoder: ['string_decoder'],
  tls: ['tls'],
  tty: ['tty'],
  url: ['url'],
  util: ['util'],
  v8: ['v8'],
  vm: ['vm'],
  zli: ['zli'],

  // Atom builtins
  shell: ['shell'],
  remote: ['remote'],
  ipc: ['ipc'],

  // node_modules
  // 'rx': ['Rx'],
  // 'temp': ['temp'],
  uuid: ['uuid'],
  ws: ['WS'],
};

function prettyNames(namesList) {
  const out = [];
  out.push(`"${namesList[0]}"`);
  for (let i = 1; i < namesList.length - 1; i++) {
    out.push(`, "${namesList[i]}"`);
  }
  if (namesList.length > 1) {
    out.push(` or "${namesList[namesList.length - 1]}"`);
  }
  return out.join('');
}

module.exports = function(context) {
  function checkNameForId(node, name, id) {
    const allowedNames = ALLOWED_NAMES_BY_MODULE[id];
    if (allowedNames.indexOf(name) === -1) {
      context.report({
        node,
        data: {
          id,
          names: prettyNames(allowedNames),
        },
        message: '{{id}} should be named {{names}}',
      });
    }
  }

  return {
    ImportDeclaration(node) {
      // Allow `import 'react';`
      if (node.specifiers.length === 0) {
        return;
      }
      const id = node.source.value;
      if (!ALLOWED_NAMES_BY_MODULE.hasOwnProperty(id)) {
        return;
      }
      for (let i = 0; i < node.specifiers.length; i++) {
        const specifier = node.specifiers[i];
        if (specifier.type === 'ImportDefaultSpecifier' ||
            specifier.type === 'ImportNamespaceSpecifier') {
          checkNameForId(specifier, specifier.local.name, id);
        } else {
          checkNameForId(specifier, null, id);
        }
      }
    },
    VariableDeclarator(node) {
      if (!isRequire(node.init)) {
        return;
      }
      const id = node.init.arguments[0].value;
      if (!ALLOWED_NAMES_BY_MODULE.hasOwnProperty(id)) {
        return;
      }
      if (node.id.type === 'Identifier') {
        checkNameForId(node.id, node.id.name, id);
      } else {
        checkNameForId(node.id, null, id);
      }
    },
  };
};
