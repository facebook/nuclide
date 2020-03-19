/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

beforeEach(async () => {
  await global.atom.reset();
});

// Disable prompt to download react devtools in atom tests
window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {isDisabled: true};
