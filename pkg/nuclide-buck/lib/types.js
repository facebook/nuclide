/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Task} from '../../commons-node/tasks';
import type {Action} from './redux/Actions';
import type {PlatformService} from './PlatformService';
import type {Observable} from 'rxjs';
import type {TaskEvent, Message} from 'nuclide-commons/process';
import type {BuckBuildSystem} from '../../nuclide-buck/lib/BuckBuildSystem';
import type {
  ResolvedBuildTarget,
  ResolvedRuleType,
} from '../../nuclide-buck-rpc/lib/types';

import * as React from 'react';

export type TaskType =
  | 'build'
  | 'run'
  | 'test'
  // A basic debug action where we produce an artifact and start a debugging session with it.
  | 'build-launch-debug'
  // Similar to build-launch-debug, but reuses the last build artifact instead of rebuilding.
  // Should only be supported if the platform is able to reuse the artifact from a previous build.
  // It's just a convenient option for advanced users that want to save rebuild time and are sure they have a working artifact.
  // If nothing changed since last build, build-launch-debug should be equivalent since the build part should be a no-op.
  | 'launch-debug'
  // Attaches the debugger to an already running artifact.
  // Should only be supported if the platform can figure out what to attach to based on a user-selected Buck target.
  | 'attach-debug';

export type BuckSubcommand = 'build' | 'run' | 'install' | 'test';

export type TaskSettings = {|
  buildArguments?: Array<string>,
  runArguments?: Array<string>,
  compileDbArguments?: Array<string>,
  keepGoing?: boolean,
|};

export type UnsanitizedTaskSettings = {|
  unsanitizedBuildArguments?: ?string,
  unsanitizedRunArguments?: ?string,
  unsanitizedCompileDbArguments?: ?string,
|};

export type AppState = {
  platformGroups: Array<PlatformGroup>,
  platformService: PlatformService,
  projectRoot: ?string,
  buckRoot: ?string,
  buckversionFileContents: ?(string | Error),
  isLoadingBuckProject: boolean,
  isLoadingRule: boolean,
  isLoadingPlatforms: boolean,
  buildTarget: string,
  buildRuleType: ?ResolvedRuleType,
  selectedDeploymentTarget: ?DeploymentTarget,
  userSelectedDeploymentTarget: ?DeploymentTarget,
  taskSettings: TaskSettings,
  platformProviderUi: ?PlatformProviderUi,

  lastSessionPlatformGroupName: ?string,
  lastSessionPlatformName: ?string,
  lastSessionDeviceGroupName: ?string,
  lastSessionDeviceName: ?string,
  unsanitizedTaskSettings: UnsanitizedTaskSettings,
};

export type TaskInfo = {
  buckRoot: string,
  buildRuleType: ResolvedRuleType,
  buildTarget: string,
  deploymentTarget: ?DeploymentTarget,
  taskSettings: TaskSettings,
};

export type Store = {
  dispatch(action: Action): void,
  getState(): AppState,
  subscribe((AppState) => mixed): () => void,
};

export type SerializedState = {
  buildTarget: ?string,
  taskSettings?: ?TaskSettings,
  selectedPlatformGroupName: ?string,
  selectedPlatformName: ?string,
  selectedDeviceGroupName: ?string,
  selectedDeviceName: ?string,
  unsanitizedTaskSettings: UnsanitizedTaskSettings,
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

export type MobilePlatform = {|
  isMobile: true,
  name: string,
  tasksForDevice: (device: Device) => Set<TaskType>,
  runTask: (
    builder: BuckBuildSystem,
    type: TaskType,
    buildTarget: ResolvedBuildTarget,
    taskSettings: TaskSettings,
    device: Device,
  ) => Observable<TaskEvent>,
  deviceGroups: Array<DeviceGroup>,
  extraUiWhenSelected?: (device: ?Device) => ?PlatformProviderUi,
  getCompilationDatabaseParams?: () => CompilationDatabaseParams,
|};

export type CompilationDatabaseParams = {
  flavorsForTarget: Array<string>,
  args: Array<string>,
  useDefaultPlatform?: boolean,
};

export type DesktopPlatform = {|
  isMobile: false,
  name: string,
  tasksForBuildRuleType: (ruleType: ResolvedRuleType) => Set<TaskType>,
  runTask: (
    builder: BuckBuildSystem,
    type: TaskType,
    buildTarget: ResolvedBuildTarget,
    taskSettings: TaskSettings,
  ) => Observable<TaskEvent>,
|};

export type Platform = MobilePlatform | DesktopPlatform;

export type DeviceGroup = {|
  name: string,
  devices: Array<Device>,
|};

export type Device = {|
  identifier: string,
  name: string,
|};

export type DeploymentTarget = {|
  platformGroup: PlatformGroup,
  platform: Platform,
  deviceGroup: ?DeviceGroup,
  device: ?Device,
|};

export type PreferredNames = {|
  platformGroupName: ?string,
  platformName: ?string,
  deviceGroupName: ?string,
  deviceName: ?string,
|};

export type PlatformProviderSettings = {
  onSave: () => mixed,
  // $FlowFixMe any type
  ui: React.Element<any>,
};

export type PlatformProviderUi = {
  settings: ?PlatformProviderSettings,
  // $FlowFixMe any type
  toolbar: ?React.Element<any>,
};

export type BuckTaskRunnerService = {|
  getBuildTarget(): ?string,
  setBuildTarget(buildTarget: string): void,
  setDeploymentTarget(preferredNames: PreferredNames): void,
  onDidCompleteTask((TaskInfo) => mixed): IDisposable,
|};

export type ConsolePrinter = (message: Message) => void;
