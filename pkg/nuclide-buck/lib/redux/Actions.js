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

import type {ResolvedRuleType} from '../../../nuclide-buck-rpc/lib/types';
import type {DeploymentTarget, PlatformGroup, TaskSettings} from '../types';

export type Action =
  | {|
      type: 'SET_PROJECT_ROOT',
      projectRoot: ?string,
    |}
  | {|
      type: 'SET_BUILD_TARGET',
      buildTarget: string,
    |}
  | {|
      type: 'SET_DEPLOYMENT_TARGET',
      deploymentTarget: DeploymentTarget,
    |}
  | {|
      type: 'SET_TASK_SETTINGS',
      settings: TaskSettings,
    |}
  // The actions below are meant to be used in Epics only.
  | {|
      type: 'SET_BUCK_ROOT',
      buckRoot: ?string,
    |}
  | {|
      type: 'SET_BUCKVERSION_FILE_CONTENTS',
      contents: ?(string | Error),
    |}
  | {|
      type: 'SET_RULE_TYPE',
      ruleType: ?ResolvedRuleType,
    |}
  | {|
      type: 'SET_PLATFORM_GROUPS',
      platformGroups: Array<PlatformGroup>,
    |};

export const SET_PROJECT_ROOT = 'SET_PROJECT_ROOT';
export const SET_BUILD_TARGET = 'SET_BUILD_TARGET';
export const SET_DEPLOYMENT_TARGET = 'SET_DEPLOYMENT_TARGET';
export const SET_TASK_SETTINGS = 'SET_TASK_SETTINGS';
export const SET_BUCK_ROOT = 'SET_BUCK_ROOT';
export const SET_BUCKVERSION_FILE_CONTENTS = 'SET_BUCKVERSION_FILE_CONTENTS';
export const SET_PLATFORM_GROUPS = 'SET_PLATFORM_GROUPS';
export const SET_RULE_TYPE = 'SET_RULE_TYPE';

export function setProjectRoot(projectRoot: ?string): Action {
  return {type: SET_PROJECT_ROOT, projectRoot};
}

export function setBuckRoot(buckRoot: ?string): Action {
  return {type: SET_BUCK_ROOT, buckRoot};
}

export function setBuckversionFileContents(
  contents: ?(string | Error),
): Action {
  return {type: SET_BUCKVERSION_FILE_CONTENTS, contents};
}

export function setBuildTarget(buildTarget: string): Action {
  return {type: SET_BUILD_TARGET, buildTarget};
}

export function setDeploymentTarget(
  deploymentTarget: DeploymentTarget,
): Action {
  return {type: SET_DEPLOYMENT_TARGET, deploymentTarget};
}

export function setTaskSettings(settings: TaskSettings): Action {
  return {type: SET_TASK_SETTINGS, settings};
}
