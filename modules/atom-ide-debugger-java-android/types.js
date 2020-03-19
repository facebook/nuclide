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

export type IJavaAndroidLaunchProcessConfig = {|
  ...IProcessConfig,
  +config: {|
    activity?: string,
    service?: string,
    intent?: string,
    deviceAndPackage: {
      deviceSerial: string,
      selectedPackage: string,
    },
    selectSources: string,
  |},
|};

export type IJavaAndroidAttachProcessConfig = {|
  ...IProcessConfig,
  +config: {|
    deviceAndProcess: {
      deviceSerial: string,
      selectedProcess: {
        user?: string,
        pid?: string,
        name: string,
      },
    },
    selectedSources?: string,
    adbServiceUri: NuclideUri,
  |},
|};
