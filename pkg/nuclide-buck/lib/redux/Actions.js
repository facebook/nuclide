'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {Device} from '../../../nuclide-ios-common';
import type {TaskSettings, TaskType} from '../types';

export type Action =
  {|
    type: 'SET_PROJECT_ROOT',
    projectRoot: ?string,
  |} |
  {|
    type: 'SET_BUILD_TARGET',
    buildTarget: string,
  |} |
  {|
    type: 'FETCH_DEVICES',
  |} |
  {|
    type: 'SET_SIMULATOR',
    simulator: string,
  |} |
  {|
    type: 'SET_TASK_SETTINGS',
    taskType: TaskType,
    settings: TaskSettings,
  |} |
  // The actions below are meant to be used in Epics only.
  {|
    type: 'SET_BUCK_ROOT',
    buckRoot: ?string,
  |} |
  {|
    type: 'SET_RULE_TYPE',
    ruleType: ?string,
  |} |
  {|
    type: 'SET_DEVICES',
    devices: Array<Device>,
  |};

export const SET_PROJECT_ROOT = 'SET_PROJECT_ROOT';
export const SET_BUILD_TARGET = 'SET_BUILD_TARGET';
export const FETCH_DEVICES = 'FETCH_DEVICES';
export const SET_SIMULATOR = 'SET_SIMULATOR';
export const SET_TASK_SETTINGS = 'SET_TASK_SETTINGS';
export const SET_BUCK_ROOT = 'SET_BUCK_ROOT';
export const SET_DEVICES = 'SET_DEVICES';
export const SET_RULE_TYPE = 'SET_RULE_TYPE';

export function setProjectRoot(projectRoot: ?string): Action {
  return {type: SET_PROJECT_ROOT, projectRoot};
}

export function setBuildTarget(buildTarget: string): Action {
  return {type: SET_BUILD_TARGET, buildTarget};
}

export function fetchDevices(): Action {
  return {type: FETCH_DEVICES};
}

export function setSimulator(simulator: string): Action {
  return {type: SET_SIMULATOR, simulator};
}

export function setTaskSettings(taskType: TaskType, settings: TaskSettings): Action {
  return {type: SET_TASK_SETTINGS, taskType, settings};
}
