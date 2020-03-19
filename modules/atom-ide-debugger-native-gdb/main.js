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

import type {NuclideDebuggerProvider} from 'nuclide-debugger-common/types';

import createPackage from 'nuclide-commons-atom/createPackage';
import {VsAdapterNames, VsAdapterTypes} from 'nuclide-debugger-common';
import {getNativeAutoGenConfig} from 'nuclide-debugger-common/autogen-utils';
import {AutoGenLaunchAttachProvider} from 'nuclide-debugger-common/AutoGenLaunchAttachProvider';
import nuclideUri from 'nuclide-commons/nuclideUri';

class Activation {
  constructor() {}
  dispose() {}

  createDebuggerProvider(): NuclideDebuggerProvider {
    return {
      type: VsAdapterTypes.NATIVE_GDB,
      getLaunchAttachProvider: connection => {
        return new AutoGenLaunchAttachProvider(
          VsAdapterNames.NATIVE_GDB,
          connection,
          getNativeAutoGenConfig(VsAdapterTypes.NATIVE_GDB),
          async () => {
            // GDB not available locally on Win32.
            return Promise.resolve(
              nuclideUri.isRemote(connection) || process.platform !== 'win32',
            );
          },
        );
      },
    };
  }
}

createPackage(module.exports, Activation);
