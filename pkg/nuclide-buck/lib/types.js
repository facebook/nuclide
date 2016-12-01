/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

import type {NuclideUri} from '../../commons-node/nuclideUri';
import type {Task} from '../../commons-node/tasks';
import type {Device} from '../../nuclide-ios-common';
import type {Action} from './redux/Actions';

export type TaskType = 'build' | 'test' | 'run' | 'debug';

export type BuckSubcommand = 'build' | 'install' | 'test';

export type TaskSettings = {
  arguments?: Array<string>,
  runArguments?: Array<string>,
};

export type AppState = {
  devices: ?Array<Device>,
  projectRoot: ?string,
  buckRoot: ?string,
  isLoadingBuckProject: boolean,
  isLoadingRule: boolean,
  buildTarget: string,
  buildRuleType: ?string,
  simulator: ?string,
  taskSettings: {[key: TaskType]: TaskSettings},
};

export type Store = {
  dispatch(action: Action): void,
  getState(): AppState,
};

export type SerializedState = {
  buildTarget: ?string,
  taskSettings?: {[key: TaskType]: TaskSettings},
  simulator: ?string,
};

export type BuildArtifactTask = Task & {
  getPathToBuildArtifact(): NuclideUri,
};

export type BuckBuilder = {
  build(opts: BuckBuilderBuildOptions): BuildArtifactTask,
};

export type BuckBuilderBuildOptions = {
  root: NuclideUri,
  target: string,
};
