/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {
  NuclideDebuggerProvider,
  DebuggerConfigurationProvider,
} from 'nuclide-debugger-common';

import createPackage from 'nuclide-commons-atom/createPackage';
import {VsAdapterTypes, VsAdapterNames} from 'nuclide-debugger-common';
import {AutoGenLaunchAttachProvider} from 'nuclide-debugger-common/AutoGenLaunchAttachProvider';
import {getJavaAndroidConfig, resolveConfiguration} from './utils';

class Activation {
  constructor() {}
  dispose() {}

  createDebuggerProvider(): NuclideDebuggerProvider {
    return {
      type: VsAdapterTypes.JAVA_ANDROID,
      getLaunchAttachProvider: connection => {
        return new AutoGenLaunchAttachProvider(
          VsAdapterNames.JAVA_ANDROID,
          connection,
          getJavaAndroidConfig(),
        );
      },
    };
  }

  createDebuggerConfigurator(): Array<DebuggerConfigurationProvider> {
    return [
      {
        resolveConfiguration,
        adapterType: VsAdapterTypes.JAVA_ANDROID,
      },
    ];
  }
}

createPackage(module.exports, Activation);
