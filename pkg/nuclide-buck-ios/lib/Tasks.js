/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {BuckBuildSystem} from '../../nuclide-buck/lib/BuckBuildSystem';
import type {TaskSettings, TaskType} from '../../nuclide-buck/lib/types';
import type {TaskEvent} from 'nuclide-commons/process';
import type {ResolvedBuildTarget} from '../../nuclide-buck-rpc/lib/types';
import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {BuckEvent} from '../../nuclide-buck/lib/BuckEventStream';
import type {FbsimctlDevice} from '../../nuclide-fbsimctl-rpc/lib/types';

// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {
  isDebugTask,
  getBuckSubcommandForTaskType,
} from '../../nuclide-buck/lib/BuckTaskRunner';
import {RUNNABLE_RULE_TYPES} from './types';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';

export function getTasks(
  buckRoot: NuclideUri,
  ruleType: string,
  buildOnly: boolean,
  debuggerAvailable: boolean,
): Set<TaskType> {
  const tasks = new Set(['build']);
  if (!buildOnly) {
    if (RUNNABLE_RULE_TYPES.has(ruleType)) {
      tasks.add('run');
    }
    if (!nuclideUri.isRemote(buckRoot)) {
      tasks.add('test');
    }
    if (debuggerAvailable) {
      tasks.add('build-launch-debug');
    }
  }
  return tasks;
}

export function runTask(
  builder: BuckBuildSystem,
  taskType: TaskType,
  ruleType: string,
  buildTarget: ResolvedBuildTarget,
  settings: TaskSettings,
  device: FbsimctlDevice,
  buckRoot: NuclideUri,
  debuggerCallback: ?(
    processStream: Observable<LegacyProcessMessage>,
  ) => Observable<BuckEvent>,
): Observable<TaskEvent> {
  const {udid, type} = device;
  let {arch} = device;
  const iosPlatform = type === 'simulator' ? 'iphonesimulator' : 'iphoneos';
  // iPhone XS returns this as architecture, but we still want to build for arm64
  if (arch.startsWith('arm64e')) {
    arch = 'arm64';
  }
  const flavor = `${iosPlatform}-${arch}`;
  const newTarget = {
    ...buildTarget,
    flavors: buildTarget.flavors.concat([flavor]),
  };

  if (nuclideUri.isRemote(buckRoot)) {
    let runRemoteTask;
    try {
      // $FlowFB
      const remoteWorkflow = require('./fb-RemoteWorkflow');
      runRemoteTask = () => {
        return remoteWorkflow.runRemoteTask(
          buckRoot,
          builder,
          taskType,
          ruleType,
          buildTarget,
          settings,
          device,
          flavor,
        );
      };
    } catch (_) {
      runRemoteTask = () => {
        throw new Error(
          'Remote workflow currently unsupported for this target.',
        );
      };
    }

    return runRemoteTask();
  } else {
    const subcommand = _getLocalSubcommand(taskType, ruleType);
    const debug = taskType === 'build-launch-debug';

    return builder.runSubcommand(
      buckRoot,
      subcommand,
      newTarget,
      settings,
      debug,
      udid,
      debug ? debuggerCallback : null,
    );
  }
}

function _getLocalSubcommand(taskType: TaskType, ruleType: string) {
  if (taskType === 'run' || isDebugTask(taskType)) {
    switch (ruleType) {
      case 'apple_bundle':
        return 'install';
      case 'apple_test':
        return 'test';
      default:
        throw new Error('Unsupported rule type');
    }
  }

  return getBuckSubcommandForTaskType(taskType);
}
