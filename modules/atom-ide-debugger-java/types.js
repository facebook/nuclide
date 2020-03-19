/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {IProcessConfig} from 'nuclide-debugger-common/types';

export type SuggestedProjectPath = {
  projectPath: NuclideUri,
  suggested: boolean,
  hostLabel: string,
};

export interface DebuggerSourcePathsService {
  addKnownJavaSubdirectoryPaths(
    remote: boolean,
    translatedPath: string,
    searchPaths: Array<string>,
  ): void;
  observeSuggestedAndroidProjectPaths(
    callback: (Array<SuggestedProjectPath>) => void,
  ): IDisposable;
}

export type IJavaLaunchProcessConfig = {|
  ...IProcessConfig,
  +config: {|
    classPath: string,
    entryPointClass: string,
    runArgs?: string[],
  |},
|};

export type IJavaAttachProcessConfig = {|
  ...IProcessConfig,
  +config: {|
    javaJdwpPort: number,
  |},
|};
