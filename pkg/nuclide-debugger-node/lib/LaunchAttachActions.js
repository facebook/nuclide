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

import type LaunchAttachDispatcher from './LaunchAttachDispatcher';
import type {
  NodeAttachTargetInfo,
} from '../../nuclide-debugger-node-rpc/lib/NodeDebuggerService';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {DebuggerProcessInfo} from '../../nuclide-debugger-base';

import {ActionTypes} from './LaunchAttachDispatcher';
import {NodeAttachProcessInfo} from './NodeAttachProcessInfo';
import {
  getNodeDebuggerServiceByNuclideUri,
} from '../../nuclide-remote-connection';
import consumeFirstProvider from '../../commons-atom/consumeFirstProvider';
import {LaunchAttachActionsBase} from '../../nuclide-debugger-base';

export class LaunchAttachActions extends LaunchAttachActionsBase {
  _dispatcher: LaunchAttachDispatcher;

  constructor(dispatcher: LaunchAttachDispatcher, targetUri: NuclideUri) {
    super(targetUri);
    this._dispatcher = dispatcher;
  }

  attachDebugger(attachTarget: NodeAttachTargetInfo): Promise<void> {
    const attachInfo = new NodeAttachProcessInfo(
      this.getTargetUri(),
      attachTarget,
    );
    return this._startDebugging(attachInfo);
  }

  async _startDebugging(processInfo: DebuggerProcessInfo): Promise<void> {
    const debuggerService = await consumeFirstProvider(
      'nuclide-debugger.remote',
    );
    await debuggerService.startDebugging(processInfo);
  }

  async updateAttachTargetList(): Promise<void> {
    const rpcService = getNodeDebuggerServiceByNuclideUri(this.getTargetUri());
    const attachTargetList = await rpcService.getAttachTargetInfoList();
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_ATTACH_TARGET_LIST,
      attachTargetInfos: attachTargetList,
    });
  }
}
