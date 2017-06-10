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

// This module only exists to load stylesheets and grammars.

let disposable: IDisposable;

export function activate() {
  disposable = require('nuclide-commons-ui');
}

export function deactivate() {
  disposable.dispose();
}
