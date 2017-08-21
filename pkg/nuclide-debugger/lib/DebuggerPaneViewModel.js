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

import DebuggerModel from './DebuggerModel';
import type {DebuggerPaneConfig} from './DebuggerLayoutManager';
import React from 'react';

// A model that will serve as the view model for all debugger panes. We must provide
// a unique instance of a view model for each pane, which Atom can destroy when the
// pane that contains it is destroyed. We therefore cannot give it the actual debugger
// model directly, since there is only one and its lifetime is tied to the lifetime
// of the debugging session.
export class DebuggerPaneViewModel {
  _config: DebuggerPaneConfig;
  _isLifetimeView: boolean;
  _debuggerModel: DebuggerModel;
  _paneDestroyed: (pane: DebuggerPaneConfig) => void;
  _removedFromLayout: boolean;
  _preferredWidth: ?number;

  constructor(
    config: DebuggerPaneConfig,
    debuggerModel: DebuggerModel,
    isLifetimeView: boolean,
    paneDestroyed: (pane: DebuggerPaneConfig) => void,
    preferredWidth: ?number,
  ) {
    this._config = config;
    this._debuggerModel = debuggerModel;
    this._isLifetimeView = isLifetimeView;
    this._paneDestroyed = paneDestroyed;
    this._removedFromLayout = false;
    this._preferredWidth = preferredWidth;
  }

  dispose(): void {}

  destroy(): void {
    if (!this._removedFromLayout) {
      this._paneDestroyed(this._config);
    }
  }

  getTitle(): string {
    return this._config.title();
  }

  getDefaultLocation(): string {
    return this._debuggerModel.getDefaultLocation();
  }

  getURI(): string {
    return this._config.uri;
  }

  getPreferredWidth(): number {
    // flowlint-next-line sketchy-null-number:off
    return this._preferredWidth || this._debuggerModel.getPreferredWidth();
  }

  createView(): React.Element<any> {
    if (this._config.previousLocation != null) {
      this._config.previousLocation.userHidden = false;
    }
    return this._config.createView();
  }

  getConfig(): DebuggerPaneConfig {
    return this._config;
  }

  isLifetimeView(): boolean {
    return this._isLifetimeView;
  }

  setRemovedFromLayout(removed: boolean): void {
    this._removedFromLayout = removed;
  }

  // Atom view needs to provide this, otherwise Atom throws an exception splitting panes for the view.
  serialize(): Object {
    return {};
  }

  copy(): boolean {
    return false;
  }
}
