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

import type {AutoGenProperty} from './types';
import type {
  NativeVsAdapterType,
  AutoGenLaunchConfig,
  AutoGenAttachConfig,
  AutoGenConfig,
} from './types';
import * as React from 'react';

import {VsAdapterTypes} from './constants';

export function generatePropertyArray(
  launchOrAttachConfigProperties: Object,
  required: string[],
  visible: string[],
): AutoGenProperty[] {
  const propertyArray = Object.entries(launchOrAttachConfigProperties)
    .map(property => {
      const name = property[0];
      const propertyDetails: any = property[1];
      const autoGenProperty: AutoGenProperty = {
        name,
        type: propertyDetails.type,
        description: propertyDetails.description,
        required: required.includes(name),
        visible: visible.includes(name),
      };
      if (typeof propertyDetails.default !== 'undefined') {
        autoGenProperty.defaultValue = propertyDetails.default;
      }
      if (
        propertyDetails.items != null &&
        typeof propertyDetails.items.type !== 'undefined'
      ) {
        autoGenProperty.itemType = propertyDetails.items.type;
      }
      if (typeof propertyDetails.enums !== 'undefined') {
        autoGenProperty.enums = propertyDetails.enums;
      }
      return autoGenProperty;
    })
    .sort((p1, p2) => {
      // TODO (goom): sort all configs, not just ones generated from the json
      if (p1.required && !p2.required) {
        return -1;
      }
      if (p2.required && !p1.required) {
        return 1;
      }
      return 0;
    });
  return propertyArray;
}

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
    description: '(Optional) Arguments to the executable',
    required: false,
    defaultValue: '',
    visible: true,
  };
  const env = {
    name: 'env',
    type: 'array',
    itemType: 'string',
    description:
      '(Optional) Environment variables (e.g. SHELL=/bin/bash PATH=/bin)',
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
    properties: [program, cwd, args, env, stopOnEntry, corePath],
    scriptPropertyName: 'program',
    scriptExtension: '.c',
    cwdPropertyName: 'working directory',
    header: <p>Debug native programs {debugTypeMessage}.</p>,
    getProcessName(values) {
      let processName = values.program;
      const lastSlash = processName.lastIndexOf('/');
      if (lastSlash >= 0) {
        processName = processName.substring(lastSlash + 1, processName.length);
      }
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
    properties: [pid],
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
