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

import type {CodeHighlightProvider} from './types';

import invariant from 'assert';
import HighlightManager from './CodeHighlightManager';

let codeHighlightManager: ?HighlightManager = null;

export function activate(state: ?Object) {
  codeHighlightManager = new HighlightManager();
}

export function consumeProvider(provider: CodeHighlightProvider) {
  invariant(codeHighlightManager != null);
  codeHighlightManager.addProvider(provider);
}

export function deactivate() {
  invariant(codeHighlightManager != null);
  codeHighlightManager.dispose();
  codeHighlightManager = null;
}
