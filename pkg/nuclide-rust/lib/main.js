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

import {
  rustLanguageService,
  resetRustLanguageService,
} from './RustLanguage';

export function activate() {
  if (process.platform !== 'win32') {
    rustLanguageService.then(value => value.activate());
  }
}

export function deactivate(): void {
  if (process.platform !== 'win32') {
    resetRustLanguageService();
  }
}
