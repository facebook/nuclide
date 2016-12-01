'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {AppState} from '../types';
import type {Action} from './Actions';

import * as Actions from './Actions';

export default function accumulateState(state: AppState, action: Action): AppState {
  switch (action.type) {
    case Actions.SET_PROJECT_ROOT:
      return {
        ...state,
        projectRoot: action.projectRoot,
        isLoadingBuckProject: true,
      };
    case Actions.SET_BUCK_ROOT:
      return {
        ...state,
        buckRoot: action.buckRoot,
        isLoadingBuckProject: false,
      };
    case Actions.SET_BUILD_TARGET:
      return {
        ...state,
        buildTarget: action.buildTarget,
        isLoadingRule: true,
      };
    case Actions.SET_RULE_TYPE:
      return {
        ...state,
        buildRuleType: action.ruleType,
        isLoadingRule: false,
      };
    case Actions.SET_DEVICES:
      let {simulator} = state;
      const isInvalidSimulator = simulator == null
        || !action.devices.some(device => device.udid === simulator);
      if (isInvalidSimulator && action.devices.length) {
        simulator = action.devices[0].udid;
      }
      return {
        ...state,
        devices: action.devices,
        simulator,
      };
    case Actions.SET_SIMULATOR:
      return {
        ...state,
        simulator: action.simulator,
      };
    case Actions.SET_TASK_SETTINGS:
      return {
        ...state,
        taskSettings: {
          ...state.taskSettings,
          [action.taskType]: action.settings,
        },
      };
  }
  return state;
}
