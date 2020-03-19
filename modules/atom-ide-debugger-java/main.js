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

import type {
  NuclideDebuggerProvider,
  DebuggerConfigurationProvider,
} from 'nuclide-debugger-common/types';
import type {DebuggerSourcePathsService} from 'nuclide-debugger-common/types';

import createPackage from 'nuclide-commons-atom/createPackage';
import {VsAdapterTypes, VsAdapterNames} from 'nuclide-debugger-common';
import {AutoGenLaunchAttachProvider} from 'nuclide-debugger-common/AutoGenLaunchAttachProvider';
import {
  getJavaConfig,
  setRpcService,
  resolveConfiguration,
  setSourcePathsService,
} from './utils';

class Activation {
  constructor() {}
  dispose() {}

  createDebuggerProvider(): NuclideDebuggerProvider {
    return {
      type: VsAdapterTypes.JAVA,
      getLaunchAttachProvider: connection => {
        return new AutoGenLaunchAttachProvider(
          VsAdapterNames.JAVA,
          connection,
          getJavaConfig(),
        );
      },
    };
  }

  createDebuggerConfigurator(): Array<DebuggerConfigurationProvider> {
    return [
      {
        resolveConfiguration,
        adapterType: VsAdapterTypes.JAVA,
      },
    ];
  }

  consumeRpcService(rpcService: nuclide$RpcService): IDisposable {
    return setRpcService(rpcService);
  }

  consumeSourcePathsService(sourcePathsService: DebuggerSourcePathsService) {
    return setSourcePathsService(sourcePathsService);
  }
}

createPackage(module.exports, Activation);
