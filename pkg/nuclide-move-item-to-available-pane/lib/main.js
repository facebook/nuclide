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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {moveDown, moveLeft, moveRight, moveUp} from './move';

class Activation {
  _disposables: UniversalDisposable;

  constructor(state: ?Object) {
    this._disposables = new UniversalDisposable();
  }

  activate() {
    this._disposables.add(
      atom.commands.add('atom-text-editor', {
        // Pass the eta expansion of these functions to defer the loading of move.js.
        'nuclide-move-item-to-available-pane:right': event =>
          moveRight(((event.target: any): HTMLElement)),
        'nuclide-move-item-to-available-pane:left': event =>
          moveLeft(((event.target: any): HTMLElement)),
        'nuclide-move-item-to-available-pane:up': event =>
          moveUp(((event.target: any): HTMLElement)),
        'nuclide-move-item-to-available-pane:down': event =>
          moveDown(((event.target: any): HTMLElement)),
      }),
    );
  }

  dispose() {
    this._disposables.dispose();
  }
}

let activation: ?Activation = null;

export function activate(state: ?Object) {
  if (activation == null) {
    activation = new Activation(state);
    activation.activate();
  }
}

export function deactivate() {
  if (activation != null) {
    activation.dispose();
    activation = null;
  }
}
