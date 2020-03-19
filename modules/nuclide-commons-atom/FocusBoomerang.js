/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

type Focus = {
  node: ?HTMLElement,
  pane: ?atom$Pane,
};

export default class FocusBoomerang {
  _focus: ?Focus;

  recordFocus(): void {
    if (this._focus != null) {
      return;
    }

    this._focus = {
      node: document.activeElement,
      pane: atom.workspace.getActivePane(),
    };
  }

  returnFocus(): void {
    if (this._focus == null) {
      return;
    }
    const {node, pane} = this._focus;
    if (node != null && document.body != null && document.body.contains(node)) {
      node.focus();
      return;
    }
    if (pane != null && !pane.isDestroyed()) {
      pane.activate();
    }
  }
}
