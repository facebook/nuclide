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

import nuclideUri from 'nuclide-commons/nuclideUri';
import fs from 'fs';

import type {VSAdapterExecutableInfo, VsAdapterType} from './types';

type AdapterInfo = {|
  executable: VSAdapterExecutableInfo,
  root: string,
|};

const modulesPath = nuclideUri.dirname(__dirname);

function resolvePackagePath(packageName: string): string {
  const bundledPath = nuclideUri.join(modulesPath, packageName);
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  } else if (typeof atom !== 'undefined') {
    const pkg = atom.packages.getActivePackage(packageName);
    if (pkg != null) {
      return nuclideUri.join(pkg.path, 'node_modules', packageName);
    }
  }
  return 'DEBUGGER_RUNTIME_NOT_FOUND';
}

const _adapters: Map<VsAdapterType, AdapterInfo> = new Map([
  [
    'node',
    {
      executable: {
        command: 'node',
        args: [
          nuclideUri.join(
            resolvePackagePath('atom-ide-debugger-node'),
            'VendorLib/vscode-node-debug2/out/src/nodeDebug.js',
          ),
        ],
      },
      root: nuclideUri.join(
        resolvePackagePath('atom-ide-debugger-node'),
        'VendorLib/vscode-node-debug2',
      ),
    },
  ],
  [
    'python',
    {
      executable: {
        command: 'node',
        args: [
          nuclideUri.join(
            resolvePackagePath('atom-ide-debugger-python'),
            'VendorLib/vs-py-debugger/out/client/debugger/debugAdapter/main.js',
          ),
        ],
      },
      root: nuclideUri.join(
        resolvePackagePath('atom-ide-debugger-python'),
        'VendorLib/vs-py-debugger',
      ),
    },
  ],
  [
    'react-native',
    {
      executable: {
        command: 'node',
        args: [
          nuclideUri.join(
            resolvePackagePath('atom-ide-debugger-react-native'),
            'VendorLib/vscode-react-native/out/debugger/reactNativeDebugEntryPoint.js',
          ),
        ],
      },
      root: nuclideUri.join(
        resolvePackagePath('atom-ide-debugger-react-native'),
        'VendorLib/vscode-react-native',
      ),
    },
  ],
  [
    'prepack',
    {
      executable: {
        command: 'node',
        args: [
          nuclideUri.join(
            __dirname,
            '../../pkg/nuclide-debugger-prepack/VendorLib/vscode-prepack/adapter/DebugAdapter.js',
          ),
        ],
      },
      root: nuclideUri.join(
        __dirname,
        '../../pkg/nuclide-debugger-prepack/VendorLib/vscode-prepack',
      ),
    },
  ],
  [
    'ocaml',
    {
      executable: {
        command: 'node',
        args: [
          nuclideUri.join(
            resolvePackagePath('atom-ide-debugger-ocaml'),
            'lib/vscode-debugger-entry.js',
          ),
        ],
      },
      root: resolvePackagePath('atom-ide-debugger-ocaml'),
    },
  ],
  [
    'native_gdb',
    {
      executable: {
        command: 'node',
        args: [
          nuclideUri.join(
            resolvePackagePath('atom-ide-debugger-native-gdb'),
            'lib/RunTranspiledServer.js',
          ),
        ],
      },
      root: resolvePackagePath('atom-ide-debugger-native-gdb'),
    },
  ],
  [
    'native_lldb',
    {
      executable: {
        command: 'lldb-vscode',
        args: [],
      },
      root: nuclideUri.join(__dirname, 'fb-native-debugger-lldb-vsp'),
    },
  ],
  [
    'java',
    {
      executable: {
        command: 'java',
        args: [],
      },
      root: resolvePackagePath('atom-ide-debugger-java'),
    },
  ],
  [
    'java_android',
    {
      executable: {
        command: 'java',
        args: [],
      },
      root: resolvePackagePath('atom-ide-debugger-java-android'),
    },
  ],
  [
    'hhvm',
    {
      executable: {
        command: 'node',
        args: [
          nuclideUri.join(
            __dirname,
            '../../pkg/nuclide-debugger-hhvm-rpc/lib/hhvmWrapper.js',
          ),
        ],
      },
      root: nuclideUri.join(__dirname, '../../pkg/nuclide-debugger-hhvm-rpc'),
    },
  ],
  [
    'mobilejs',
    {
      executable: {
        command: 'node',
        args: [
          nuclideUri.join(
            __dirname,
            '../../pkg/fb-debugger-mobilejs-rpc/lib/vscode/vscode-debugger-entry.js',
          ),
        ],
      },
      root: nuclideUri.join(__dirname, '../../pkg/fb-debugger-mobilejs-rpc'),
    },
  ],
]);

export function getAdapterExecutable(
  adapter: VsAdapterType,
): VSAdapterExecutableInfo {
  const adapterInfo = _adapters.get(adapter);
  if (adapterInfo == null) {
    throw new Error(`Cannot find VSP for given adapter type ${adapter}`);
  }
  return adapterInfo.executable;
}

export function getAdapterPackageRoot(adapter: VsAdapterType): string {
  const adapterInfo = _adapters.get(adapter);
  if (adapterInfo == null) {
    throw new Error(`Cannot find VSP for given adapter type ${adapter}`);
  }
  return adapterInfo.root;
}
