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

import type {ConsoleService} from 'atom-ide-ui';

import invariant from 'assert';
import Activation from './Activation';

let activation: ?Activation = null;

export function activate(state: ?Object) {
  activation = new Activation(state);
}

export function deactivate() {
  invariant(activation != null);
  activation.dispose();
  activation = null;
}

export function consumeConsole(consoleService: ConsoleService): IDisposable {
  invariant(activation);
  return activation.consumeConsole(consoleService);
}
