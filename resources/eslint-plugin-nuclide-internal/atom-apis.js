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

const MISSING_MENU_ITEM_ERROR = 'All workspace-level Atom commands ' +
  'should have a corresponding menu item in the same package.';

const COMMAND_LITERAL_ERROR = 'Please use literals for Atom commands. ' +
  'This improves readability and makes command names easily greppable.';

const WORKSPACE_VIEW_LOOKUP_ERROR = 'Prefer the string "atom-workspace" to calling'
  + ' `atom.views.getView()`.';

const DISALLOWED_WORKSPACE_METHODS = {
  open: 'Prefer goToLocation (commons-atom/go-to-location) to atom.workspace.open',
  observeTextEditors: 'Use observeTextEditors from commons-atom/text-editor instead of ' +
    'atom.workspace.observeTextEditors. It ignores broken nuclide:/path ' +
    'URIs, which appear briefly when reloading Atom with remote projects.',
  isTextEditor: 'Use isValidTextEditor from commons-atom/text-editor instead of ' +
    'atom.workspace.isTextEditor. It additionally blocks editors with broken nuclide:/path ' +
    'URIs, which appear briefly when reloading Atom with remote projects.',
};

// Commands with these prefixes will be whitelisted.
const WHITELISTED_PREFIXES = [
  'core:',
  'sample-',
];

function isCommandWhitelisted(command) {
  return WHITELISTED_PREFIXES.some(prefix => command.startsWith(prefix));
}

// Returns the values of literals and simple constant variables.
function resolveValue(node, context) {
  if (node.type === 'Literal') {
    return node.value;
  }
  if (node.type === 'Identifier') {
    const refs = context.getScope().references;
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (ref.identifier.name === node.name) {
        if (ref.writeExpr != null) {
          return resolveValue(ref.writeExpr, context);
        }
        return null;
      }
    }
  }
  // Give up for anything more complex.
  return null;
}

const menuConfigCache = {};

// Returns a list of all JSON (we don't use CSON) configs in the "menus"
// subdirectory of the package that owns `filePath`.
function findMenuConfigs(filePath) {
  let dir = path.dirname(filePath);
  let parent = path.dirname(dir);

  while (dir !== parent) {
    const menuDir = path.join(dir, 'menus');
    if (fs.existsSync(menuDir)) {
      if (menuConfigCache[menuDir] != null) {
        return menuConfigCache[menuDir];
      }
      const configs = [];
      menuConfigCache[menuDir] = configs;
      fs.readdirSync(menuDir).forEach(configFile => {
        if (configFile.endsWith('.json')) {
          const configFilePath = path.join(menuDir, configFile);
          try {
            const contents = fs.readFileSync(configFilePath, 'utf-8');
            configs.push(JSON.parse(contents));
          } catch (e) {
            // ignore
          }
        }
      });
      return configs;
    }
    dir = parent;
    parent = path.dirname(dir);
  }

  return [];
}

function menuItemContainsCommand(item, command) {
  if (item.command != null) {
    return command === item.command;
  }
  if (item.submenu != null) {
    return item.submenu.some(subitem => menuItemContainsCommand(subitem, command));
  }
  return false;
}

function menuContainsCommand(config, command) {
  if (config.menu == null) {
    return false;
  }
  return config.menu.some(item => {
    return menuItemContainsCommand(item, command);
  });
}

function checkLiterals(literals, context) {
  const configs = findMenuConfigs(context.getFilename());
  for (let i = 0; i < literals.length; i++) {
    if (isCommandWhitelisted(literals[i].value)) {
      continue;
    }
    if (!configs.some(config => menuContainsCommand(config, literals[i].value))) {
      context.report({
        node: literals[i],
        message: MISSING_MENU_ITEM_ERROR + ' (' + literals[i].value + ')',
      });
    }
  }
}

function isSpecFile(filename) {
  return filename.includes('/spec/') || filename.endsWith('-spec.js');
}

/**
 * Capture calls of the form:
 * - atom.commands.add('atom-workspace', 'command', callback)
 * - atom.commands.add('atom-workspace', {'command': callback, ...})
 *
 * We then look up the `command` in nearby `menus/*.cson` files.
 * Every matching commmand should have a corresponding entry somewhere.
 */
module.exports = function(context) {
  function checkCommandAddCall(node) {
    const args = node.arguments;
    if (args.length !== 2 && args.length !== 3) {
      return;
    }

    const callee = context.getSourceCode().getText(node.callee);
    if (callee !== 'atom.commands.add') {
      return;
    }

    const firstValue = resolveValue(args[0], context);
    if (firstValue == null) {
      // Another common pattern for atom.commands.add. Be lazy and just get the string..
      const stringValue = context.getSourceCode().getText(args[0]);
      if (stringValue.replace(/\s/g, '') === 'atom.views.getView(atom.workspace)') {
        context.report({
          node: node.callee,
          message: WORKSPACE_VIEW_LOOKUP_ERROR,
        });
      } else {
        return;
      }
    } else if (firstValue !== 'atom-workspace') {
      return;
    }

    if (args[1].type === 'Literal') {
      checkLiterals([args[1]], context);
    } else if (args[1].type === 'ObjectExpression') {
      const commands = [];
      args[1].properties.forEach(prop => {
        if (prop.key.type === 'Literal') {
          commands.push(prop.key);
        }
      });
      checkLiterals(commands, context);
    } else if (resolveValue(args[1], context) !== null) {
      context.report({
        node: args[1],
        message: COMMAND_LITERAL_ERROR,
      });
    }
    // Unresolvable or dynamic expressions are ignored.
  }

  /**
   * Ensures that Workspace Views consumers of the form:
   *
   *   api.registerFactory({
   *     ...
   *     toggleCommand: $COMMAND_NAME,
   *     ...
   *   });
   *
   * have a matching menu item for $COMMAND_NAME.
   * See nuclide-workspace-views for the API specification.
   *
   * Since this isn't type-aware, false positives are possible for other methods
   * named `registerFactory` that take a `toggleCommand` key.
   *
   * This also won't catch cases where a variable is used instead of an object literal,
   * but this shouldn't really happen in practice.
   */
  function checkWorkspaceFactory(node) {
    if (node.callee.type !== 'MemberExpression' ||
        node.callee.property.name !== 'registerFactory') {
      return;
    }
    const args = node.arguments;
    if (args.length !== 1 || args[0].type !== 'ObjectExpression') {
      return;
    }
    for (const prop of args[0].properties) {
      if (prop.key.name === 'toggleCommand' &&
          prop.value.type === 'Literal') {
        checkLiterals([prop.value], context);
      }
    }
  }

  function disallowWorkspaceOpen(node) {
    if (isSpecFile(context.getFilename())) {
      return;
    }
    if (node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'MemberExpression' &&
        node.callee.object.object.type === 'Identifier' &&
        node.callee.object.object.name === 'atom' &&
        node.callee.object.property.type === 'Identifier' &&
        node.callee.object.property.name === 'workspace' &&
        node.callee.property.type === 'Identifier'
    ) {
      const message = DISALLOWED_WORKSPACE_METHODS[node.callee.property.name];
      if (message != null) {
        context.report({node, message});
      }
    }
  }

  function visitCallExpression(node) {
    checkCommandAddCall(node);
    checkWorkspaceFactory(node);
    disallowWorkspaceOpen(node);
  }

  return {
    CallExpression: visitCallExpression,
  };
};

// For testing
module.exports.MISSING_MENU_ITEM_ERROR = MISSING_MENU_ITEM_ERROR;
module.exports.COMMAND_LITERAL_ERROR = COMMAND_LITERAL_ERROR;
module.exports.WORKSPACE_VIEW_LOOKUP_ERROR = WORKSPACE_VIEW_LOOKUP_ERROR;
module.exports.DISALLOWED_WORKSPACE_METHODS = DISALLOWED_WORKSPACE_METHODS;
