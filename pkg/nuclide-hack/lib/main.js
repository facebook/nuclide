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

import type {SymbolResult, Provider} from '../../nuclide-quick-open/lib/types';

import {HackSymbolProvider} from './HackSymbolProvider';
import {hackLanguageService, resetHackLanguageService} from './HackLanguage';

export function activate() {
  hackLanguageService.then(value => value.activate());
}

export function deactivate(): void {
  resetHackLanguageService();
}

export function registerQuickOpenProvider(): Provider<SymbolResult> {
  return HackSymbolProvider;
}
