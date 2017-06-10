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
import type {Task} from '../../commons-node/tasks';
import type {Action} from './redux/Actions';
import type {PlatformService} from './PlatformService';
import type {Observable} from 'rxjs';
import type {TaskEvent} from 'nuclide-commons/process';
import type {BuckBuildSystem} from '../../nuclide-buck/lib/BuckBuildSystem';
import type {
  ResolvedBuildTarget,
  ResolvedRuleType,
} from '../../nuclide-buck-rpc/lib/BuckService';

import React from 'react';

export type TaskType = 'build' | 'run' | 'test' | 'debug';

export type BuckSubcommand = 'build' | 'run' | 'install' | 'test';

export type TaskSettings = {|
  buildArguments?: Array<string>,
  runArguments?: Array<string>,
|};

export type AppState = {
  platformGroups: Array<PlatformGroup>,
  platformService: PlatformService,
  projectRoot: ?string,
  buckRoot: ?string,
  isLoadingBuckProject: boolean,
  isLoadingRule: boolean,
  isLoadingPlatforms: boolean,
  buildTarget: string,
  buildRuleType: ?ResolvedRuleType,
  selectedDeploymentTarget: ?DeploymentTarget,
  taskSettings: TaskSettings,
  platformProviderUi: ?PlatformProviderUi,

  lastSessionPlatformName: ?string,
  lastSessionDeviceName: ?string,
};

export type Store = {
  dispatch(action: Action): void,
  getState(): AppState,
};

export type SerializedState = {
  buildTarget: ?string,
  taskSettings?: ?TaskSettings,
  selectedPlatformName: ?string,
  selectedDeviceName: ?string,
};

export type BuckBuildOutput = {
  target: string,
  successType: string,
  path: string,
};

export type BuckBuildTask = Task & {
  getBuildOutput(): BuckBuildOutput,
};

export type BuckBuildOptions = {
  root: NuclideUri,
  target: ResolvedBuildTarget,
  args?: Array<string>,
};

export type PlatformGroup = {
  name: string,
  platforms: Array<Platform>,
};

export type MobilePlatform = {
  isMobile: true,
  name: string,
  tasksForDevice: (device: ?Device) => Set<TaskType>,
  runTask: (
    builder: BuckBuildSystem,
    type: TaskType,
    buildTarget: ResolvedBuildTarget,
    taskSettings: TaskSettings,
    device: ?Device,
  ) => Observable<TaskEvent>,
  deviceGroups: Array<DeviceGroup>,
  extraUiWhenSelected?: (device: ?Device) => ?PlatformProviderUi,
};

export type DesktopPlatform = {
  isMobile: false,
  name: string,
  tasksForBuildRuleType: (ruleType: ResolvedRuleType) => Set<TaskType>,
  runTask: (
    builder: BuckBuildSystem,
    type: TaskType,
    buildTarget: ResolvedBuildTarget,
    taskSettings: TaskSettings,
    device: ?Device,
  ) => Observable<TaskEvent>,
};

export type Platform = MobilePlatform | DesktopPlatform;

export type DeviceGroup = {
  name: ?string,
  devices: Array<Device>,
};

export type Device = {
  name: string,
};

export type DeploymentTarget = {
  platform: Platform,
  device: ?Device,
};

export type PlatformProviderSettings = {
  onSave: () => mixed,
  ui: React.Element<any>,
};

export type PlatformProviderUi = {
  settings: ?PlatformProviderSettings,
  toolbar: ?React.Element<any>,
};
