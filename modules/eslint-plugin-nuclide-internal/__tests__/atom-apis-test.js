/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 * @emails oncall+nuclide
 * @format
 */
'use strict';

/* eslint nuclide-internal/no-commonjs: 0 */

const path = require('path');
const rule = require('../atom-apis');
const RuleTester = require('eslint').RuleTester;

const getFullPath = relativePath => {
  return path.join(__dirname, '../__mocks__', relativePath);
};

const ruleTester = new RuleTester({
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module',
  },
});

ruleTester.run('atom-commands', rule, {
  valid: [
    {code: 'atom.commands.add.test("atom-workspace", "command", cb)'},
    // ignores non-workspace commands
    {code: 'atom.commands.add("atom-text-editor", "test", cb)'},
    {code: 'atom.commands.add(test, "test", cb)'},
    // ignores non-trivial expressions
    {code: 'atom.commands.add("atom-workspace", f(), cb)'},
    // these are contained in menus
    {
      code: 'atom.commands.add("atom-workspace", "good_command", null)',
      filename: getFullPath('test.js'),
    },
    {
      code: 'atom.commands.add("atom-workspace", "good_command2", null)',
      filename: getFullPath('test.js'),
    },
    {
      code: 'api.registerFactory({toggleCommand: "good_command"})',
      filename: getFullPath('test.js'),
    },
    {
      code: 'registerFactory({toggleCommand: "bad_command"})',
      filename: getFullPath('test.js'),
    },
    {
      code: 'atom.workspace.open()',
      filename: 'in-a-spec.js',
    },
    {
      code: 'atom.workspace.open()',
      filename: '/in/a/spec/folder.js',
    },
  ],
  invalid: [
    {
      code: 'atom.commands.add("atom-workspace", "command", cb)',
      errors: [
        {
          message: rule.MISSING_MENU_ITEM_ERROR + ' (command)',
          type: 'Literal',
        },
      ],
    },
    {
      code: 'atom.commands.add("atom-workspace", {"a": cb, "b": cb})',
      errors: [
        {
          message: rule.MISSING_MENU_ITEM_ERROR + ' (a)',
          type: 'Literal',
        },
        {
          message: rule.MISSING_MENU_ITEM_ERROR + ' (b)',
          type: 'Literal',
        },
      ],
    },
    {
      code: 'var x = "command"; atom.commands.add("atom-workspace", x, cb)',
      errors: [
        {
          message: rule.COMMAND_LITERAL_ERROR,
          type: 'Identifier',
        },
      ],
    },
    {
      code: 'atom.commands.add("atom-workspace", "bad_command", null)',
      filename: getFullPath('test.js'),
      errors: [
        {
          message: rule.MISSING_MENU_ITEM_ERROR + ' (bad_command)',
          type: 'Literal',
        },
      ],
    },
    {
      code: 'atom.commands.add("atom-workspace", "bad_command2", null)',
      filename: getFullPath('test.js'),
      errors: [
        {
          message: rule.MISSING_MENU_ITEM_ERROR + ' (bad_command2)',
          type: 'Literal',
        },
      ],
    },
    {
      code: 'api.registerFactory({toggleCommand: "bad_command"})',
      filename: getFullPath('test.js'),
      errors: [
        {
          message: rule.MISSING_MENU_ITEM_ERROR + ' (bad_command)',
          type: 'Literal',
        },
      ],
    },
    {
      code: 'atom.commands.add(atom.views.getView(atom.workspace), f(), cb)',
      errors: [
        {
          message: rule.WORKSPACE_VIEW_LOOKUP_ERROR,
        },
      ],
    },
    {
      code: 'atom.workspace.open()',
      filename: 'not-a-test.js',
      errors: [
        {
          message: rule.DISALLOWED_WORKSPACE_METHODS.open,
        },
      ],
    },
    {
      code: 'atom.workspace.open()',
      filename: 'in/a/nonspec/folder.js',
      errors: [
        {
          message: rule.DISALLOWED_WORKSPACE_METHODS.open,
        },
      ],
    },
  ],
});
