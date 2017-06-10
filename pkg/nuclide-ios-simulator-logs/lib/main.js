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

import type {OutputService} from '../../nuclide-console/lib/types';

import invariant from 'assert';
import Activation from './Activation';

let activation: ?Object = null;

export function activate(state: ?Object) {
  invariant(activation == null);
  activation = new Activation(state);
}

export function deactivate() {
  invariant(activation);
  activation.dispose();
  activation = null;
}

export function consumeOutputService(api: OutputService): void {
  invariant(activation);
  activation.consumeOutputService(api);
}
