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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {DebuggerProcessInfo} from '../../nuclide-debugger-base';

import consumeFirstProvider from '../../commons-atom/consumeFirstProvider';

const ATTACH_TARGET_LIST_REFRESH_INTERVAL = 2000;

export class LaunchAttachActionsBase {
  _targetUri: NuclideUri;
  _refreshTimerId: ?number;
  _parentUIVisible: boolean;
  _attachUIVisible: boolean;

  constructor(targetUri: NuclideUri) {
    this._targetUri = targetUri;
    this._refreshTimerId = null;
    this._parentUIVisible = true; // Visible by default.
    this._attachUIVisible = false;
    (this: any).updateAttachUIVisibility = this.updateAttachUIVisibility.bind(
      this,
    );
    (this: any).updateParentUIVisibility = this.updateParentUIVisibility.bind(
      this,
    );
  }

  getTargetUri(): NuclideUri {
    return this._targetUri;
  }

  updateParentUIVisibility(visible: boolean): void {
    this._parentUIVisible = visible;
    this._updateAutoRefresh();
  }

  updateAttachUIVisibility(visible: boolean): void {
    this._attachUIVisible = visible;
    this._updateAutoRefresh();
  }

  _updateAutoRefresh(): void {
    this._killAutoRefreshTimer();
    if (this._parentUIVisible && this._attachUIVisible) {
      this.updateAttachTargetList();
      this._refreshTimerId = setInterval(
        this.updateAttachTargetList,
        ATTACH_TARGET_LIST_REFRESH_INTERVAL,
      );
    }
  }

  async updateAttachTargetList(): Promise<void> {
    throw Error('Not implemented');
  }

  _killAutoRefreshTimer(): void {
    if (this._refreshTimerId != null) {
      clearTimeout(this._refreshTimerId);
      this._refreshTimerId = null;
    }
  }

  toggleLaunchAttachDialog(): void {
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'nuclide-debugger:toggle-launch-attach',
    );
  }

  showDebuggerPanel(): void {
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'nuclide-debugger:show',
    );
  }

  async startDebugging(processInfo: DebuggerProcessInfo): Promise<void> {
    const debuggerService = await consumeFirstProvider(
      'nuclide-debugger.remote',
    );
    await debuggerService.startDebugging(processInfo);
  }

  dispose(): void {
    this._killAutoRefreshTimer();
  }
}
