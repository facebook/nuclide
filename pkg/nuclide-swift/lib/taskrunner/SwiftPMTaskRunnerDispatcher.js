/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

import Dispatcher from '../../../commons-node/Dispatcher';

type SwiftPMTaskRunnerAction =
  | {
      actionType: 'UPDATE_PROJECT_ROOT',
      projectRoot: ?string,
    }
  | {
      actionType: 'UPDATE_CHDIR',
      chdir: string,
    }
  | {
      actionType: 'UPDATE_SETTINGS',
      configuration: string,
      Xcc: string,
      Xlinker: string,
      Xswiftc: string,
      buildPath: string,
    }
  | {
      actionType: 'UPDATE_COMPILE_COMMANDS',
      compileCommands: Map<string, Array<string>>,
    };

export const ActionTypes = Object.freeze({
  UPDATE_PROJECT_ROOT: 'UPDATE_PROJECT_ROOT',
  UPDATE_CHDIR: 'UPDATE_CHDIR',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  UPDATE_COMPILE_COMMANDS: 'UPDATE_COMPILE_COMMANDS',
});

// Flow hack: Every SwiftPMTaskRunnerAction actionType must be in ActionTypes.
// $FlowFixMe(>=0.55.0) Flow suppress
(('': $PropertyType<SwiftPMTaskRunnerAction, 'actionType'>): $Keys<
  typeof ActionTypes,
>);

export default class SwiftPMTaskRunnerDispatcher extends Dispatcher<
  SwiftPMTaskRunnerAction,
> {}
