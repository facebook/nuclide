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

import type {AttachTargetInfo} from '../../nuclide-debugger-native-rpc/lib/NativeDebuggerServiceInterface';

import Dispatcher from '../../commons-node/Dispatcher';

export type LaunchAttachAction = {
  actionType: 'UPDATE_ATTACH_TARGET_LIST',
  attachTargetInfos: Array<AttachTargetInfo>,
};

export const ActionTypes = Object.freeze({
  UPDATE_ATTACH_TARGET_LIST: 'UPDATE_ATTACH_TARGET_LIST',
});

// Flow hack: Every LaunchAttachAction actionType must be in ActionTypes.
// $FlowFixMe(>=0.55.0) Flow suppress
(('': $PropertyType<LaunchAttachAction, 'actionType'>): $Keys<
  typeof ActionTypes,
>);

export default class LaunchAttachDispatcher extends Dispatcher<
  LaunchAttachAction,
> {}
