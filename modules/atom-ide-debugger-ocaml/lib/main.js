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
  AutoGenConfig,
  AutoGenLaunchConfig,
  NuclideDebuggerProvider,
} from 'nuclide-debugger-common/types';

import createPackage from 'nuclide-commons-atom/createPackage';
import {AutoGenLaunchAttachProvider} from 'nuclide-debugger-common/AutoGenLaunchAttachProvider';
import {VsAdapterNames, VsAdapterTypes} from 'nuclide-debugger-common';
import {Logger} from 'vscode-debugadapter';

class Activation {
  constructor() {}
  dispose() {}

  createDebuggerProvider(): NuclideDebuggerProvider {
    return {
      type: VsAdapterTypes.OCAML,
      getLaunchAttachProvider: connection => {
        return new AutoGenLaunchAttachProvider(
          VsAdapterNames.OCAML,
          connection,
          getOCamlAutoGenConfig(),
        );
      },
    };
  }
}

function getOCamlAutoGenConfig(): AutoGenConfig {
  const debugExecutable = {
    name: 'ocamldebugExecutable',
    type: 'string',
    description: 'Path to ocamldebug or launch script',
    required: true,
    visible: true,
  };
  const executablePath = {
    name: 'executablePath',
    type: 'string',
    description:
      'Input the executable path you want to launch (leave blank if using an ocamldebug launch script)',
    required: false,
    visible: true,
  };
  const argumentsProperty = {
    name: 'arguments',
    type: 'array',
    itemType: 'string',
    description: 'Arguments to the executable',
    required: false,
    defaultValue: [],
    visible: true,
  };
  const environmentVariables = {
    name: 'environmentVariables',
    type: 'array',
    itemType: 'string',
    description: 'Environment variables (e.g. SHELL=/bin/bash PATH=/bin)',
    required: false,
    defaultValue: [],
    visible: true,
  };
  const workingDirectory = {
    name: 'workingDirectory',
    type: 'string',
    description: 'Working directory for the launched executable',
    required: true,
    visible: true,
  };
  const additionalIncludeDirectories = {
    name: 'includeDirectories',
    type: 'array',
    itemType: 'string',
    description:
      'Additional include directories that debugger will use to search for source code',
    required: false,
    defaultValue: [],
    visible: true,
  };
  const breakAfterStart = {
    name: 'breakAfterStart',
    type: 'boolean',
    description: '',
    required: false,
    defaultValue: true,
    visible: true,
  };
  const logLevel = {
    name: 'logLevel',
    type: 'string',
    description: '',
    required: false,
    defaultValue: Logger.LogLevel.Verbose,
    visible: false,
  };

  const autoGenLaunchConfig: AutoGenLaunchConfig = {
    launch: true,
    vsAdapterType: VsAdapterTypes.OCAML,
    properties: [
      debugExecutable,
      executablePath,
      argumentsProperty,
      environmentVariables,
      workingDirectory,
      additionalIncludeDirectories,
      breakAfterStart,
      logLevel,
    ],
    scriptPropertyName: 'executable',
    cwdPropertyName: 'working directory',
    header: null,
    getProcessName(values) {
      return values.debugExecutable + ' (OCaml)';
    },
  };
  return {
    launch: autoGenLaunchConfig,
    attach: null,
  };
}

createPackage(module.exports, Activation);
