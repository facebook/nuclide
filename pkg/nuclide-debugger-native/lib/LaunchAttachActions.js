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
  AttachTargetInfo,
  LaunchTargetInfo,
} from '../../nuclide-debugger-native-rpc/lib/NativeDebuggerServiceInterface';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {DebuggerProcessInfo} from '../../nuclide-debugger-base';
import typeof * as NativeDebuggerService
  from '../../nuclide-debugger-native-rpc/lib/NativeDebuggerServiceInterface';

import invariant from 'assert';
import {AttachProcessInfo} from './AttachProcessInfo';
import {LaunchProcessInfo} from './LaunchProcessInfo';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';
import consumeFirstProvider from '../../commons-atom/consumeFirstProvider';
import {ActionTypes} from './LaunchAttachDispatcher';
import {LaunchAttachActionsBase} from '../../nuclide-debugger-base';

export class LaunchAttachActions extends LaunchAttachActionsBase {
  _dispatcher: LaunchAttachDispatcher;

  constructor(dispatcher: LaunchAttachDispatcher, targetUri: NuclideUri) {
    super(targetUri);
    this._dispatcher = dispatcher;
  }

  attachDebugger(attachTarget: AttachTargetInfo): Promise<void> {
    const attachInfo = new AttachProcessInfo(this.getTargetUri(), attachTarget);
    return this._startDebugging(attachInfo);
  }

  launchDebugger(launchTarget: LaunchTargetInfo): Promise<void> {
    const launchInfo = new LaunchProcessInfo(this.getTargetUri(), launchTarget);
    return this._startDebugging(launchInfo);
  }

  async _startDebugging(processInfo: DebuggerProcessInfo): Promise<void> {
    const debuggerService = await consumeFirstProvider(
      'nuclide-debugger.remote',
    );
    await debuggerService.startDebugging(processInfo);
  }

  // Override.
  async updateAttachTargetList(): Promise<void> {
    const rpcService: ?NativeDebuggerService = getServiceByNuclideUri(
      'NativeDebuggerService',
      this.getTargetUri(),
    );
    invariant(rpcService);
    const attachTargetList = await rpcService.getAttachTargetInfoList();
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_ATTACH_TARGET_LIST,
      attachTargetInfos: attachTargetList,
    });
  }
}
