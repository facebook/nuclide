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

/* eslint-disable nuclide-internal/no-commonjs */

/**
 * Load expensive dependencies before packages import them so they don't skew
 * profiling. These dependencies are unavoidable and shared by many packages
 * so their expensive should not be attributed to any one package.
 *
 * This file must:
 *
 * - Be loaded after the require hook transpiler is applied.
 * - Be transpiled so that `use-minified-libs-tr` is applied to it.
 * - Use `require` and not `import` to avoid `inline-imports` optimizations.
 */

require('immutable');
require('log4js');
require('react');
require('react-dom');
require('redux');
require('rxjs');

// Single out fs-plus since we can probably remove it one day.
require('fs-plus');
