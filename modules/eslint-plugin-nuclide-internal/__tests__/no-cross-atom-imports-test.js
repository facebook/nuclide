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

/* eslint-disable max-len */

const path = require('path');

const rule = require('../no-cross-atom-imports');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester({
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module',
  },
});

const getFullPath = relativePath => {
  return path.join(__dirname, '../__mocks__', relativePath);
};

ruleTester.run('no-cross-atom-imports', rule, {
  valid: [
    //--------------------------------------------------------------------------
    // atom-1 => atom builtin
    //--------------------------------------------------------------------------

    {
      code: 'require("atom");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import "atom";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export {} from "atom";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export * from "atom";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // atom-1 => atom-1
    //--------------------------------------------------------------------------

    // require
    {
      code: 'require("../nuclide-fake-atom-package-1/file.js");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'require("./file.js");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'require("./");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // import
    {
      code: 'import "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import "./file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import "./";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // export {}
    {
      code: 'export {} from "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export {} from "./file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export {} from "./";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // export *
    {
      code: 'export * from "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export * from "./file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export * from "./";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // atom-1 => node-npm-1
    //--------------------------------------------------------------------------

    // require
    {
      code: 'require("../nuclide-fake-node-npm-package-1");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-npm-package-1/file.js");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-npm-package-1/index.js");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-npm-package-1/package.json");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // import
    {
      code: 'import "../nuclide-fake-node-npm-package-1";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-npm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-npm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-npm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // export {}
    {
      code: 'export {} from "../nuclide-fake-node-npm-package-1";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-npm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-npm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-npm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // export *
    {
      code: 'export * from "../nuclide-fake-node-npm-package-1";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-npm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-npm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-npm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // atom-1 => node-apm-1
    //--------------------------------------------------------------------------

    // require
    {
      code: 'require("../nuclide-fake-node-apm-package-1");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-apm-package-1/file.js");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-apm-package-1/index.js");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-apm-package-1/package.json");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // import
    {
      code: 'import "../nuclide-fake-node-apm-package-1";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-apm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-apm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-apm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // export {}
    {
      code: 'export {} from "../nuclide-fake-node-apm-package-1";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-apm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-apm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-apm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // export *
    {
      code: 'export * from "../nuclide-fake-node-apm-package-1";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-apm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-apm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-apm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // node-apm-1 => atom builtin
    //--------------------------------------------------------------------------

    {
      code: 'require("atom");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'import "atom";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export {} from "atom";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export * from "atom";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // node-apm-1 => node-apm-2
    //--------------------------------------------------------------------------

    // require
    {
      code: 'require("../nuclide-fake-node-apm-package-2");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-apm-package-2/file.js");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-apm-package-2/index.js");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-apm-package-2/package.json");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    // import
    {
      code: 'import "../nuclide-fake-node-apm-package-2";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-apm-package-2/file.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-apm-package-2/index.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-apm-package-2/package.json";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    // export {}
    {
      code: 'export {} from "../nuclide-fake-node-apm-package-2";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-apm-package-2/file.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-apm-package-2/index.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-apm-package-2/package.json";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    // export *
    {
      code: 'export * from "../nuclide-fake-node-apm-package-2";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-apm-package-2/file.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-apm-package-2/index.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-apm-package-2/package.json";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // node-apm-1 => node-npm-1
    //--------------------------------------------------------------------------

    // require
    {
      code: 'require("../nuclide-fake-node-npm-package-1");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-npm-package-1/file.js");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-npm-package-1/index.js");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-npm-package-1/package.json");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    // import
    {
      code: 'import "../nuclide-fake-node-npm-package-1";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-npm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-npm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-npm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    // export {}
    {
      code: 'export {} from "../nuclide-fake-node-npm-package-1";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-npm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-npm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-npm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    // export *
    {
      code: 'export * from "../nuclide-fake-node-npm-package-1";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-npm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-npm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-npm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // node-npm-1 => node-npm-2
    //--------------------------------------------------------------------------

    // require
    {
      code: 'require("../nuclide-fake-node-npm-package-2");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-npm-package-2/file.js");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-npm-package-2/index.js");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'require("../nuclide-fake-node-npm-package-2/package.json");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    // import
    {
      code: 'import "../nuclide-fake-node-npm-package-2";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-npm-package-2/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-npm-package-2/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import "../nuclide-fake-node-npm-package-2/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    // export {}
    {
      code: 'export {} from "../nuclide-fake-node-npm-package-2";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-npm-package-2/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-npm-package-2/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export {} from "../nuclide-fake-node-npm-package-2/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    // export *
    {
      code: 'export * from "../nuclide-fake-node-npm-package-2";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-npm-package-2/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-npm-package-2/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export * from "../nuclide-fake-node-npm-package-2/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // atom-1 => node_modules
    //--------------------------------------------------------------------------

    // require
    {
      code: 'require("module-that-does-not-exit");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'require("eslint");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'require("eslint/lib/eslint.js");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'require("eslint/package.json");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // import
    {
      code: 'import "module-that-does-not-exit";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import "eslint";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import "eslint/lib/eslint.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import "eslint/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // export {}
    {
      code: 'export {} from "module-that-does-not-exit";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export {} from "eslint";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export {} from "eslint/lib/eslint.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export {} from "eslint/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // export *
    {
      code: 'export * from "module-that-does-not-exit";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export * from "eslint";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export * from "eslint/lib/eslint.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export * from "eslint/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // node-npm-1 => node_modules
    //--------------------------------------------------------------------------

    // require
    {
      code: 'require("module-that-does-not-exit");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'require("eslint");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'require("eslint/lib/eslint.js");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'require("eslint/package.json");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    // import
    {
      code: 'import "module-that-does-not-exit";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import "eslint";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import "eslint/lib/eslint.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import "eslint/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    // export {}
    {
      code: 'export {} from "module-that-does-not-exit";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export {} from "eslint";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export {} from "eslint/lib/eslint.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export {} from "eslint/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    // export *
    {
      code: 'export * from "module-that-does-not-exit";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export * from "eslint";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export * from "eslint/lib/eslint.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export * from "eslint/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // node-npm-1 => atom builtin (type)
    //--------------------------------------------------------------------------

    {
      code: 'import type x from "atom";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import typeof x from "atom";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export type {} from "atom";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // node-npm-1 => node-apm-1 (type)
    //--------------------------------------------------------------------------

    // import type
    {
      code: 'import type x from "../nuclide-fake-node-apm-package-1";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import type x from "../nuclide-fake-node-apm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import type x from "../nuclide-fake-node-apm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code:
        'import type x from "../nuclide-fake-node-apm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    // import typeof
    {
      code: 'import typeof x from "../nuclide-fake-node-apm-package-1";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code:
        'import typeof x from "../nuclide-fake-node-apm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code:
        'import typeof x from "../nuclide-fake-node-apm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code:
        'import typeof x from "../nuclide-fake-node-apm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    // export {}
    {
      code: 'export type {} from "../nuclide-fake-node-apm-package-1";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export type {} from "../nuclide-fake-node-apm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code:
        'export type {} from "../nuclide-fake-node-apm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code:
        'export type {} from "../nuclide-fake-node-apm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // node-apm-1 => atom-1 (type)
    //--------------------------------------------------------------------------

    // import type
    {
      code: 'import type x from "../nuclide-fake-atom-package-1";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'import type x from "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'import type x from "../nuclide-fake-atom-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'import type x from "../nuclide-fake-atom-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    // import typeof
    {
      code: 'import typeof x from "../nuclide-fake-atom-package-1";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'import typeof x from "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'import typeof x from "../nuclide-fake-atom-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code:
        'import typeof x from "../nuclide-fake-atom-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    // export {}
    {
      code: 'export type {} from "../nuclide-fake-atom-package-1";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export type {} from "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code: 'export type {} from "../nuclide-fake-atom-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },
    {
      code:
        'export type {} from "../nuclide-fake-atom-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // node-npm-1 => atom-1 (type)
    //--------------------------------------------------------------------------

    // import type
    {
      code: 'import type x from "../nuclide-fake-atom-package-1";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import type x from "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import type x from "../nuclide-fake-atom-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import type x from "../nuclide-fake-atom-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    // import typeof
    {
      code: 'import typeof x from "../nuclide-fake-atom-package-1";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import typeof x from "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'import typeof x from "../nuclide-fake-atom-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code:
        'import typeof x from "../nuclide-fake-atom-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    // export {}
    {
      code: 'export type {} from "../nuclide-fake-atom-package-1";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export type {} from "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code: 'export type {} from "../nuclide-fake-atom-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },
    {
      code:
        'export type {} from "../nuclide-fake-atom-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // atom-1 => atom-2 (type)
    //--------------------------------------------------------------------------

    // import type
    {
      code: 'import type x from "../nuclide-fake-atom-package-2";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import type x from "../nuclide-fake-atom-package-2/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import type x from "../nuclide-fake-atom-package-2/index.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import type x from "../nuclide-fake-atom-package-2/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // import typeof
    {
      code: 'import typeof x from "../nuclide-fake-atom-package-2";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import typeof x from "../nuclide-fake-atom-package-2/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'import typeof x from "../nuclide-fake-atom-package-2/index.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code:
        'import typeof x from "../nuclide-fake-atom-package-2/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    // export {}
    {
      code: 'export type {} from "../nuclide-fake-atom-package-2";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export type {} from "../nuclide-fake-atom-package-2/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code: 'export type {} from "../nuclide-fake-atom-package-2/index.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },
    {
      code:
        'export type {} from "../nuclide-fake-atom-package-2/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
    },

    //--------------------------------------------------------------------------
    // whitelist
    //--------------------------------------------------------------------------

    {
      code: 'require("../nuclide-fake-atom-package-2");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      options: [{whitelist: ['nuclide-fake-atom-package-2']}],
    },
    {
      code: 'require("../nuclide-fake-atom-package-2");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      options: [{whitelist: ['nuclide-fake-atom-package-2']}],
    },
  ],
  invalid: [
    //--------------------------------------------------------------------------
    // node-npm-1 => atom builtin
    //--------------------------------------------------------------------------

    {
      code: 'require("atom");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom builtin package "atom" is not requireable from a Node library.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'import "atom";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom builtin package "atom" is not importable from a Node library.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'export {} from "atom";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom builtin package "atom" is not exportable from a Node library.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    {
      code: 'export * from "atom";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom builtin package "atom" is not exportable from a Node library.',
          type: 'ExportAllDeclaration',
        },
      ],
    },

    //--------------------------------------------------------------------------
    // node-npm-1 => node-apm-1
    //--------------------------------------------------------------------------

    // require
    {
      code: 'require("../nuclide-fake-node-apm-package-1");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not requireable from a Node library.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require("../nuclide-fake-node-apm-package-1/file.js");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not requireable from a Node library.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require("../nuclide-fake-node-apm-package-1/index.js");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not requireable from a Node library.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require("../nuclide-fake-node-apm-package-1/package.json");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not requireable from a Node library.',
          type: 'CallExpression',
        },
      ],
    },
    // import
    {
      code: 'import "../nuclide-fake-node-apm-package-1";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not importable from a Node library.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import "../nuclide-fake-node-apm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not importable from a Node library.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import "../nuclide-fake-node-apm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not importable from a Node library.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import "../nuclide-fake-node-apm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not importable from a Node library.',
          type: 'ImportDeclaration',
        },
      ],
    },
    // export {}
    {
      code: 'export {} from "../nuclide-fake-node-apm-package-1";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not exportable from a Node library.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    {
      code: 'export {} from "../nuclide-fake-node-apm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not exportable from a Node library.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    {
      code: 'export {} from "../nuclide-fake-node-apm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not exportable from a Node library.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    {
      code: 'export {} from "../nuclide-fake-node-apm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not exportable from a Node library.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    // export *
    {
      code: 'export * from "../nuclide-fake-node-apm-package-1";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not exportable from a Node library.',
          type: 'ExportAllDeclaration',
        },
      ],
    },
    {
      code: 'export * from "../nuclide-fake-node-apm-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not exportable from a Node library.',
          type: 'ExportAllDeclaration',
        },
      ],
    },
    {
      code: 'export * from "../nuclide-fake-node-apm-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not exportable from a Node library.',
          type: 'ExportAllDeclaration',
        },
      ],
    },
    {
      code: 'export * from "../nuclide-fake-node-apm-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-1" is not exportable from a Node library.',
          type: 'ExportAllDeclaration',
        },
      ],
    },

    //--------------------------------------------------------------------------
    // node-apm-1 => atom-1
    //--------------------------------------------------------------------------

    // require
    {
      code: 'require("../nuclide-fake-atom-package-1");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require("../nuclide-fake-atom-package-1/file.js");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require("../nuclide-fake-atom-package-1/index.js");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require("../nuclide-fake-atom-package-1/package.json");',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    // import
    {
      code: 'import "../nuclide-fake-atom-package-1";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not importable from other packages.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not importable from other packages.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import "../nuclide-fake-atom-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not importable from other packages.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import "../nuclide-fake-atom-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not importable from other packages.',
          type: 'ImportDeclaration',
        },
      ],
    },
    // export {}
    {
      code: 'export {} from "../nuclide-fake-atom-package-1";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    {
      code: 'export {} from "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    {
      code: 'export {} from "../nuclide-fake-atom-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    {
      code: 'export {} from "../nuclide-fake-atom-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    // export *
    {
      code: 'export * from "../nuclide-fake-atom-package-1";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportAllDeclaration',
        },
      ],
    },
    {
      code: 'export * from "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportAllDeclaration',
        },
      ],
    },
    {
      code: 'export * from "../nuclide-fake-atom-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportAllDeclaration',
        },
      ],
    },
    {
      code: 'export * from "../nuclide-fake-atom-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-apm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportAllDeclaration',
        },
      ],
    },

    //--------------------------------------------------------------------------
    // node-npm-1 => atom-1
    //--------------------------------------------------------------------------

    // require
    {
      code: 'require("../nuclide-fake-atom-package-1");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require("../nuclide-fake-atom-package-1/file.js");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require("../nuclide-fake-atom-package-1/index.js");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require("../nuclide-fake-atom-package-1/package.json");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    // import
    {
      code: 'import "../nuclide-fake-atom-package-1";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not importable from other packages.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not importable from other packages.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import "../nuclide-fake-atom-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not importable from other packages.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import "../nuclide-fake-atom-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not importable from other packages.',
          type: 'ImportDeclaration',
        },
      ],
    },
    // export {}
    {
      code: 'export {} from "../nuclide-fake-atom-package-1";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    {
      code: 'export {} from "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    {
      code: 'export {} from "../nuclide-fake-atom-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    {
      code: 'export {} from "../nuclide-fake-atom-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    // export *
    {
      code: 'export * from "../nuclide-fake-atom-package-1";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportAllDeclaration',
        },
      ],
    },
    {
      code: 'export * from "../nuclide-fake-atom-package-1/file.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportAllDeclaration',
        },
      ],
    },
    {
      code: 'export * from "../nuclide-fake-atom-package-1/index.js";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportAllDeclaration',
        },
      ],
    },
    {
      code: 'export * from "../nuclide-fake-atom-package-1/package.json";',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not exportable from other packages.',
          type: 'ExportAllDeclaration',
        },
      ],
    },

    //--------------------------------------------------------------------------
    // atom-1 => atom-2
    //--------------------------------------------------------------------------

    // require
    {
      code: 'require("../nuclide-fake-atom-package-2");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require("../nuclide-fake-atom-package-2/file.js");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require("../nuclide-fake-atom-package-2/index.js");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require("../nuclide-fake-atom-package-2/package.json");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'require.resolve("../nuclide-fake-atom-package-2/package.json");',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    // import
    {
      code: 'import "../nuclide-fake-atom-package-2";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not importable from other packages.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import "../nuclide-fake-atom-package-2/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not importable from other packages.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import "../nuclide-fake-atom-package-2/index.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not importable from other packages.',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      code: 'import "../nuclide-fake-atom-package-2/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not importable from other packages.',
          type: 'ImportDeclaration',
        },
      ],
    },
    // export {}
    {
      code: 'export {} from "../nuclide-fake-atom-package-2";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not exportable from other packages.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    {
      code: 'export {} from "../nuclide-fake-atom-package-2/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not exportable from other packages.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    {
      code: 'export {} from "../nuclide-fake-atom-package-2/index.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not exportable from other packages.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    {
      code: 'export {} from "../nuclide-fake-atom-package-2/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not exportable from other packages.',
          type: 'ExportNamedDeclaration',
        },
      ],
    },
    // export *
    {
      code: 'export * from "../nuclide-fake-atom-package-2";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not exportable from other packages.',
          type: 'ExportAllDeclaration',
        },
      ],
    },
    {
      code: 'export * from "../nuclide-fake-atom-package-2/file.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not exportable from other packages.',
          type: 'ExportAllDeclaration',
        },
      ],
    },
    {
      code: 'export * from "../nuclide-fake-atom-package-2/index.js";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not exportable from other packages.',
          type: 'ExportAllDeclaration',
        },
      ],
    },
    {
      code: 'export * from "../nuclide-fake-atom-package-2/package.json";',
      filename: getFullPath('nuclide-fake-atom-package-1/index.js'),
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-2" is not exportable from other packages.',
          type: 'ExportAllDeclaration',
        },
      ],
    },

    //--------------------------------------------------------------------------
    // whitelist
    //--------------------------------------------------------------------------

    {
      // whitelist does *not* apply to npm packages
      code: 'require("../nuclide-fake-atom-package-1");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      options: [{whitelist: ['nuclide-fake-atom-package-1']}],
      errors: [
        {
          message:
            'Atom package "nuclide-fake-atom-package-1" is not requireable from other packages.',
          type: 'CallExpression',
        },
      ],
    },
    {
      // whitelist does *not* apply to npm packages
      code: 'require("../nuclide-fake-node-apm-package-2");',
      filename: getFullPath('nuclide-fake-node-npm-package-1/index.js'),
      options: [{whitelist: ['nuclide-fake-node-apm-package-2']}],
      errors: [
        {
          message:
            'Atom package "nuclide-fake-node-apm-package-2" is not requireable from a Node library.',
          type: 'CallExpression',
        },
      ],
    },
  ],
});
