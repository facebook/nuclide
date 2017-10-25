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

import type {AppState} from '../types';
import type {Action} from './Actions';

import * as Actions from './Actions';
import {
  getDeploymentTargetPreference,
  getPlatformProviderUiForDeploymentTarget,
  selectValidDeploymentTarget,
} from '../DeploymentTarget';

export default function accumulateState(
  state: AppState,
  action: Action,
): AppState {
  switch (action.type) {
    case Actions.SET_PROJECT_ROOT:
      return {
        ...state,
        projectRoot: action.projectRoot,
        buckversionFileContents: null,
        isLoadingBuckProject: true,
      };
    case Actions.SET_BUCK_ROOT:
      return {
        ...state,
        buckRoot: action.buckRoot,
        isLoadingBuckProject: false,
      };
    case Actions.SET_BUCKVERSION_FILE_CONTENTS:
      return {
        ...state,
        buckversionFileContents: action.contents,
      };
    case Actions.SET_BUILD_TARGET:
      // We are nulling out the deployment target while platforms are loaded
      // Let's remember what we had selected in the last session fields
      const preference = getDeploymentTargetPreference(state);
      return {
        ...state,
        buildRuleType: null,
        platformGroups: [],
        selectedDeploymentTarget: null,
        platformProviderUi: null,
        buildTarget: action.buildTarget,
        isLoadingRule: true,
        lastSessionPlatformGroupName: preference.platformGroupName,
        lastSessionPlatformName: preference.platformName,
        lastSessionDeviceGroupName: preference.deviceGroupName,
        lastSessionDeviceName: preference.deviceName,
      };
    case Actions.SET_RULE_TYPE:
      return {
        ...state,
        buildRuleType: action.ruleType,
        isLoadingRule: false,
        isLoadingPlatforms: true,
      };
    case Actions.SET_PLATFORM_GROUPS:
      const {platformGroups} = action;
      const selectedDeploymentTarget = selectValidDeploymentTarget(
        getDeploymentTargetPreference(state),
        platformGroups,
      );
      return {
        ...state,
        platformGroups,
        selectedDeploymentTarget,
        platformProviderUi: getPlatformProviderUiForDeploymentTarget(
          selectedDeploymentTarget,
        ),
        isLoadingPlatforms: false,
      };
    case Actions.SET_DEPLOYMENT_TARGET:
      return {
        ...state,
        selectedDeploymentTarget: action.deploymentTarget,
        platformProviderUi: getPlatformProviderUiForDeploymentTarget(
          action.deploymentTarget,
        ),
        lastSessionPlatformGroupName: null,
        lastSessionPlatformName: null,
        lastSessionDeviceGroupName: null,
        lastSessionDeviceName: null,
      };
    case Actions.SET_TASK_SETTINGS:
      return {
        ...state,
        taskSettings: action.settings,
      };
  }
  return state;
}
