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
import type {IProcessConfig, VsAdapterType} from 'nuclide-debugger-common';
import type {
  AutoGenConfig,
  AutoGenLaunchConfig,
  NativeVsAdapterType,
  AutoGenAttachConfig,
} from 'nuclide-debugger-common/types';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {VsAdapterTypes} from 'nuclide-debugger-common';
import * as React from 'react';

export type VspNativeDebuggerLaunchBuilderParms = {
  args: Array<string>,
  cwd: string,
  env: Array<string>,
  sourcePath: string,
};

export type VspNativeDebuggerAttachBuilderParms = {
  pid?: number,
  sourcePath: string,
  stopCommands?: Array<string>,
};

export function getNativeAutoGenConfig(
  vsAdapterType: NativeVsAdapterType,
): AutoGenConfig {
  const program = {
    name: 'program',
    type: 'path',
    description: 'Input the program/executable you want to launch',
    required: true,
    visible: true,
  };
  const cwd = {
    name: 'cwd',
    type: 'path',
    description: 'Working directory for the launched executable',
    required: true,
    visible: true,
  };
  const args = {
    name: 'args',
    type: 'array',
    itemType: 'string',
    description: 'Arguments to the executable',
    required: false,
    defaultValue: '',
    visible: true,
  };
  const env = {
    name: 'env',
    type: 'array',
    itemType: 'string',
    description: 'Environment variables (e.g., SHELL=/bin/bash PATH=/bin)',
    required: false,
    defaultValue: '',
    visible: true,
  };
  const sourcePath = {
    name: 'sourcePath',
    type: 'path',
    description: 'Optional base path for sources',
    required: false,
    defaultValue: '',
    visible: true,
  };
  const corePath = {
    name: 'coreDumpPath',
    type: 'path',
    description: 'Optional path to a core file to load in the debugger',
    required: false,
    defaultValue: '',
    visible: true,
  };
  const stopOnEntry = {
    name: 'pauseProgramOnEntry',
    type: 'boolean',
    description:
      'If true, the debugger will stop the program at entry before starting execution.',
    required: false,
    defaultValue: false,
    visible: true,
  };

  const debugTypeMessage = `using ${
    vsAdapterType === VsAdapterTypes.NATIVE_GDB ? 'gdb' : 'lldb'
  }`;

  const autoGenLaunchConfig: AutoGenLaunchConfig = {
    launch: true,
    vsAdapterType,
    properties: [program, cwd, args, env, sourcePath, stopOnEntry, corePath],
    scriptPropertyName: 'program',
    cwdPropertyName: 'working directory',
    header: <p>Debug native programs {debugTypeMessage}.</p>,
    getProcessName(values) {
      let processName = values.program;
      const lastSlash = processName.lastIndexOf('/');
      if (lastSlash >= 0) {
        processName = processName.substring(lastSlash + 1, processName.length);
      }
      processName += ' (' + debugTypeMessage + ')';
      return processName;
    },
  };

  const pid = {
    name: 'pid',
    type: 'process',
    description: '',
    required: true,
    visible: true,
  };
  const autoGenAttachConfig: AutoGenAttachConfig = {
    launch: false,
    vsAdapterType,
    properties: [pid, sourcePath],
    header: <p>Attach to a running native process {debugTypeMessage}</p>,
    getProcessName(values) {
      return 'Pid: ' + values.pid + ' (' + debugTypeMessage + ')';
    },
  };
  return {
    launch: autoGenLaunchConfig,
    attach: autoGenAttachConfig,
  };
}

export function getNativeVSPLaunchProcessConfig(
  adapterType: VsAdapterType,
  program: NuclideUri,
  config: VspNativeDebuggerLaunchBuilderParms,
): IProcessConfig {
  return {
    targetUri: program,
    debugMode: 'launch',
    adapterType,
    config: {
      program: nuclideUri.getPath(program),
      ...config,
    },
  };
}

export function getNativeVSPAttachProcessConfig(
  adapterType: VsAdapterType,
  targetUri: NuclideUri,
  config: VspNativeDebuggerAttachBuilderParms,
): IProcessConfig {
  return {
    targetUri,
    debugMode: 'attach',
    adapterType,
    config,
  };
}
