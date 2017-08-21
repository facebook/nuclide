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

import type {CwdApi} from '../../nuclide-current-working-directory/lib/CwdApi';
import type {OutputService} from '../../nuclide-console/lib/types';

import invariant from 'assert';
import Activation from './Activation';

let activation: ?Activation = null;

export function activate(state: ?Object): void {
  invariant(activation == null);
  activation = new Activation(state);
}

export function deactivate(): void {
  invariant(activation != null);
  activation.dispose();
  activation = null;
}

export function consumeOutputService(api: OutputService): void {
  invariant(activation != null);
  return activation.consumeOutputService(api);
}

export function consumeCwdApi(api: CwdApi): void {
  invariant(activation != null);
  return activation.consumeCwdApi(api);
}
