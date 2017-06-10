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

import type {
  NodeAttachTargetInfo,
} from '../../nuclide-debugger-node-rpc/lib/NodeDebuggerService';

import Dispatcher from '../../commons-node/Dispatcher';

export type LaunchAttachAction = {
  actionType: 'UPDATE_ATTACH_TARGET_LIST',
  attachTargetInfos: Array<NodeAttachTargetInfo>,
};

export const ActionTypes = Object.freeze({
  UPDATE_ATTACH_TARGET_LIST: 'UPDATE_ATTACH_TARGET_LIST',
});

// Flow hack: Every LaunchAttachAction actionType must be in ActionTypes.
(('': $PropertyType<LaunchAttachAction, 'actionType'>): $Keys<
  typeof ActionTypes,
>);

export default class LaunchAttachDispatcher
  extends Dispatcher<LaunchAttachAction> {}
