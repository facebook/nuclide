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
import type {BuckBuildSystem} from '../../nuclide-buck/lib/BuckBuildSystem';
import type {
  Device,
  TaskSettings,
  TaskType,
} from '../../nuclide-buck/lib/types';
import type {TaskEvent} from 'nuclide-commons/process';
import type {ResolvedBuildTarget} from '../../nuclide-buck-rpc/lib/types';
import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {BuckEvent} from '../../nuclide-buck/lib/BuckEventStream';
import type {IosDeployable} from './types';

import {RUNNABLE_RULE_TYPES} from './types';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';

export function getTasks(
  buckRoot: NuclideUri,
  ruleType: string,
  device: ?Device,
  debuggerAvailable: boolean,
): Set<TaskType> {
  // $FlowIgnore typecast
  const iosDeployable: IosDeployable = device;
  const tasks = new Set(['build']);
  if (iosDeployable.buildOnly !== true) {
    if (RUNNABLE_RULE_TYPES.has(ruleType)) {
      tasks.add('run');
    }
    if (!nuclideUri.isRemote(buckRoot)) {
      tasks.add('test');
      if (debuggerAvailable) {
        tasks.add('debug');
      }
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
  device: ?Device,
  buckRoot: NuclideUri,
  debuggerCallback: ?(
    processStream: Observable<LegacyProcessMessage>,
  ) => Observable<BuckEvent>,
): Observable<TaskEvent> {
  // $FlowIgnore typecast
  const iosDeployable: IosDeployable = device;
  const {arch, udid, type} = iosDeployable;
  const iosPlatform = type === 'simulator' ? 'iphonesimulator' : 'iphoneos';
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
          iosDeployable,
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
    if (subcommand === 'install' || subcommand === 'test') {
      startLogger(iosDeployable);
    }

    const debug = taskType === 'debug';

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
  if (taskType !== 'run' && taskType !== 'debug') {
    return taskType;
  }
  switch (ruleType) {
    case 'apple_bundle':
      return 'install';
    case 'apple_test':
      return 'test';
    default:
      throw new Error('Unsupported rule type');
  }
}

function startLogger(iosDeployable: IosDeployable): Observable<TaskEvent> {
  return Observable.create(observer => {
    if (iosDeployable.type === 'simulator') {
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'nuclide-ios-simulator-logs:start',
      );
    }
    observer.complete();
  });
}
