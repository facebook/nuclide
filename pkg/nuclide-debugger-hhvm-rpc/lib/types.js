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

export type HHVMLaunchConfig = {
  action: 'launch',
  targetUri: NuclideUri,
  startupDocumentPath?: string,
  launchScriptPath: NuclideUri,
  scriptArgs: Array<string>,
  hhvmRuntimePath?: string,
  hhvmRuntimeArgs: Array<string>,
  deferLaunch: boolean,
  launchWrapperCommand?: string,
  cwd?: string,
  noDebug?: boolean,
  warnOnInterceptedFunctions?: boolean,
  notifyOnBpCalibration?: boolean,
};

export type HHVMAttachConfig = {
  action: 'attach',
  targetUri: NuclideUri,
  startupDocumentPath?: string,
  debugPort?: number,
  warnOnInterceptedFunctions?: boolean,
  notifyOnBpCalibration?: boolean,
};
