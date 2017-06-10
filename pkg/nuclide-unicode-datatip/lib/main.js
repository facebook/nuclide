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

import type {DatatipService} from '../../nuclide-datatip/lib/types';

import invariant from 'assert';
import UnicodeDatatipManager from './UnicodeDatatipManager';

let unicodeEscapesManager: ?UnicodeDatatipManager = null;

export function activate(state: ?Object) {
  unicodeEscapesManager = new UnicodeDatatipManager();
}

export function consumeDatatipService(service: DatatipService): IDisposable {
  invariant(unicodeEscapesManager != null);
  return unicodeEscapesManager.consumeDatatipService(service);
}

export function deactivate() {
  invariant(unicodeEscapesManager != null);
  unicodeEscapesManager.dispose();
  unicodeEscapesManager = null;
}
