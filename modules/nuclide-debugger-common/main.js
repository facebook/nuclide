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

export type {
  AtomNotificationType,
  ControlButtonSpecification,
  DebuggerConfigAction,
  DebuggerConfigurationProvider,
  DebuggerSourcePathsService,
  Device,
  DevicePanelServiceApi,
  IProcessConfig,
  IVspInstance,
  MessageProcessor,
  NuclideDebuggerProvider,
  VSAdapterExecutableInfo,
  VsAdapterType,
} from './types';

export {
  getVSCodeDebuggerAdapterServiceByNuclideUri,
} from './debug-adapter-service';

export {
  default as DebuggerLaunchAttachProvider,
} from './DebuggerLaunchAttachProvider';

export {default as VsDebugSession} from './VsDebugSession';

export {VsAdapterTypes, VsAdapterNames} from './constants';

export {
  deserializeDebuggerConfig,
  serializeDebuggerConfig,
} from './DebuggerConfigSerializer';

export {
  localToRemoteProcessor,
  pathProcessor,
  remoteToLocalProcessor,
} from './processors';

export {default as VsAdapterSpawner} from './VsAdapterSpawner';
