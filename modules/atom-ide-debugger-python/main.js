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
  AutoGenConfig,
  NuclideDebuggerProvider,
} from 'nuclide-debugger-common/types';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {VsAdapterNames, VsAdapterTypes} from 'nuclide-debugger-common';
import * as React from 'react';
import createPackage from 'nuclide-commons-atom/createPackage';
import {AutoGenLaunchAttachProvider} from 'nuclide-debugger-common/AutoGenLaunchAttachProvider';
import {listenToRemoteDebugCommands, setRpcService} from './utils';

export const NUCLIDE_PYTHON_DEBUGGER_DEX_URI =
  'https://our.intern.facebook.com/intern/dex/python-and-fbcode/debugging/#nuclide';

class Activation {
  _subscriptions: UniversalDisposable;

  constructor() {
    this._subscriptions = new UniversalDisposable(
      listenToRemoteDebugCommands(),
    );
  }

  dispose() {
    this._subscriptions.dispose();
  }

  consumeRpcService(rpcService: nuclide$RpcService): IDisposable {
    return setRpcService(rpcService);
  }

  createDebuggerProvider(): NuclideDebuggerProvider {
    return {
      type: VsAdapterTypes.PYTHON,
      getLaunchAttachProvider: connection => {
        return new AutoGenLaunchAttachProvider(
          VsAdapterNames.PYTHON,
          connection,
          getPythonAutoGenConfig(),
        );
      },
    };
  }
}

export function getPythonAutoGenConfig(): AutoGenConfig {
  const program = {
    name: 'program',
    type: 'path',
    description: 'Absolute path to the program.',
    required: true,
    visible: true,
  };
  const pythonPath = {
    name: 'pythonPath',
    type: 'path',
    description: 'Path to python executable.',
    required: true,
    visible: true,
  };
  const cwd = {
    name: 'cwd',
    type: 'path',
    description:
      '(Optional) Absolute path to the working directory of the program being debugged. Default is the root directory of the file.',
    required: true,
    visible: true,
  };
  const args = {
    name: 'args',
    type: 'array',
    itemType: 'string',
    description: 'Command line arguments passed to the program',
    defaultValue: [],
    required: false,
    visible: true,
  };
  const stopOnEntry = {
    name: 'stopOnEntry',
    type: 'boolean',
    description: 'Automatically stop after launch.',
    defaultValue: false,
    required: false,
    visible: true,
  };
  const debugOptions = {
    name: 'debugOptions',
    type: 'array',
    itemType: 'string',
    description: 'Advanced options, view read me for further details.',
    defaultValue: ['WaitOnAbnormalExit', 'WaitOnNormalExit', 'RedirectOutput'],
    required: false,
    visible: false,
  };
  const env = {
    name: 'env',
    type: 'object',
    description:
      '(Optional) Environment variables (e.g. SHELL=/bin/bash PATH=/bin)',
    defaultValue: {},
    required: false,
    visible: true,
  };
  const consoleEnum = {
    name: 'console',
    type: 'enum',
    enums: ['internalConsole', 'integratedTerminal'],
    description: '',
    defaultValue: 'internalConsole',
    required: true,
    visible: true,
  };

  return {
    launch: {
      launch: true,
      vsAdapterType: VsAdapterTypes.PYTHON,
      properties: [
        program,
        pythonPath,
        cwd,
        args,
        stopOnEntry,
        debugOptions,
        env,
        consoleEnum,
      ],
      scriptPropertyName: 'program',
      scriptExtension: '.py',
      cwdPropertyName: 'cwd',
      header: isNuclideEnvironment() ? (
        <p>
          This is intended to debug python script files.
          <br />
          To debug buck targets, you should{' '}
          <a href={NUCLIDE_PYTHON_DEBUGGER_DEX_URI}>
            use the buck toolbar instead
          </a>.
        </p>
      ) : null,
      getProcessName(values) {
        let processName = values.program;
        const lastSlash = processName.lastIndexOf('/');
        if (lastSlash >= 0) {
          processName = processName.substring(
            lastSlash + 1,
            processName.length,
          );
        }
        processName += ' (Python)';
        return processName;
      },
    },
    attach: null,
  };
}

function isNuclideEnvironment(): boolean {
  return atom.packages.isPackageLoaded('nuclide');
}

createPackage(module.exports, Activation);
