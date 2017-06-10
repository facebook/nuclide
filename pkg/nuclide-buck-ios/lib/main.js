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
  PlatformGroup,
  TaskSettings,
  TaskType,
} from '../../nuclide-buck/lib/types';
import type {TaskEvent} from 'nuclide-commons/process';
import type {PlatformService} from '../../nuclide-buck/lib/PlatformService';
import type {ResolvedBuildTarget} from '../../nuclide-buck-rpc/lib/BuckService';

import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Disposable} from 'atom';
import {Observable} from 'rxjs';
import * as IosSimulator from '../../nuclide-ios-common';
import invariant from 'assert';

let disposable: ?Disposable = null;

const RUNNABLE_RULE_TYPES = new Set(['apple_bundle']);

const SUPPORTED_RULE_TYPES = new Set([...RUNNABLE_RULE_TYPES, 'apple_test']);

export function deactivate(): void {
  if (disposable != null) {
    disposable.dispose();
    disposable = null;
  }
}

export function consumePlatformService(service: PlatformService): void {
  disposable = service.register(provideIosDevices);
}

function provideIosDevices(
  buckRoot: NuclideUri,
  ruleType: string,
  buildTarget: string,
): Observable<?PlatformGroup> {
  if (!SUPPORTED_RULE_TYPES.has(ruleType)) {
    return Observable.of(null);
  }

  return Observable.fromPromise(
    fsPromise.exists(nuclideUri.join(buckRoot, 'mode', 'oculus-mobile')),
  ).switchMap(result => {
    if (result) {
      return Observable.of(null);
    } else {
      return IosSimulator.getFbsimctlSimulators().map(simulators => {
        if (!simulators.length) {
          return null;
        }

        return {
          name: 'iOS Simulators',
          platforms: [
            {
              isMobile: true,
              name: 'iOS Simulators',
              tasksForDevice: device => getTasks(buckRoot, ruleType),
              runTask: (builder, taskType, target, settings, device) =>
                _runTask(
                  builder,
                  taskType,
                  ruleType,
                  target,
                  settings,
                  device,
                  buckRoot,
                ),
              deviceGroups: [
                {
                  name: 'iOS Simulators',
                  devices: simulators.map(simulator => ({
                    name: `${simulator.name} (${simulator.os})`,
                    udid: simulator.udid,
                    arch: simulator.arch,
                  })),
                },
              ],
            },
          ],
        };
      });
    }
  });
}

function getTasks(buckRoot: NuclideUri, ruleType: string): Set<TaskType> {
  const tasks = new Set(['build']);
  if (RUNNABLE_RULE_TYPES.has(ruleType)) {
    tasks.add('run');
  }
  if (!nuclideUri.isRemote(buckRoot)) {
    tasks.add('test');
    tasks.add('debug');
  }
  return tasks;
}

function _runTask(
  builder: BuckBuildSystem,
  taskType: TaskType,
  ruleType: string,
  buildTarget: ResolvedBuildTarget,
  settings: TaskSettings,
  device: ?Device,
  buckRoot: NuclideUri,
): Observable<TaskEvent> {
  invariant(device);
  invariant(device.arch);
  invariant(device.udid);
  const udid = device.udid;
  const arch = device.arch;
  invariant(typeof arch === 'string');
  invariant(typeof udid === 'string');

  const flavor = `iphonesimulator-${arch}`;
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
          udid,
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
    return builder.runSubcommand(
      buckRoot,
      _getLocalSubcommand(taskType, ruleType),
      newTarget,
      settings,
      taskType === 'debug',
      udid,
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
