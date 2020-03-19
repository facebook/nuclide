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

const STATUS_BAR_PRIORITY = 500;

// TODO: Allow the user to toggle this feature.
import invariant from 'assert';
import * as React from 'react';
import ReactDOM from 'react-dom';
import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import KeyBindingHint from './KeyBindingHint';

class Activation {
  _disposables: UniversalDisposable;
  _statusNode: ?HTMLElement;

  constructor(state: ?mixed) {
    this._statusNode = document.createElement('div');
    this._statusNode.classList.add('inline-block', 'text');
    invariant(this._statusNode);
    ReactDOM.render(<KeyBindingHint />, this._statusNode);

    this._disposables = new UniversalDisposable(() => {
      ReactDOM.unmountComponentAtNode(this._statusNode);
      this._statusNode = null;
    });
  }

  consumeStatusBar(statusBar) {
    const keyBindingStatusBar = statusBar.addLeftTile({
      item: this._statusNode,
      priority: STATUS_BAR_PRIORITY,
    });

    this._disposables.add(() => {
      keyBindingStatusBar.destroy();
    });
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
