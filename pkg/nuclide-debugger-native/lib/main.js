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

import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {NuclideDebuggerProvider} from '../../nuclide-debugger-interfaces/service';
import type {DebuggerLaunchAttachProvider} from '../../nuclide-debugger-base';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {PlatformService} from '../../nuclide-buck/lib/PlatformService';
import type {PlatformGroup} from '../../nuclide-buck/lib/types';
import typeof * as BuckService from '../../nuclide-buck-rpc';
import type {BuckBuildSystem} from '../../nuclide-buck/lib/BuckBuildSystem';
import type {
  Device,
  TaskSettings,
  TaskType,
} from '../../nuclide-buck/lib/types';
import type {TaskEvent} from 'nuclide-commons/process';
import type {ResolvedBuildTarget} from '../../nuclide-buck-rpc/lib/types';
import type {BuckEvent} from '../../nuclide-buck/lib/BuckEventStream';

import createPackage from 'nuclide-commons-atom/createPackage';
import {Observable} from 'rxjs';
import logger from './utils';
import {getConfig} from './utils';
import {LLDBLaunchAttachProvider} from './LLDBLaunchAttachProvider';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import invariant from 'invariant';
import type RemoteControlService from '../../nuclide-debugger/lib/RemoteControlService';
import consumeFirstProvider from '../../commons-atom/consumeFirstProvider';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {AttachProcessInfo} from '../../nuclide-debugger-native/lib/AttachProcessInfo';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {LaunchProcessInfo} from '../../nuclide-debugger-native/lib/LaunchProcessInfo';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';
import {getBuckServiceByNuclideUri} from '../../nuclide-remote-connection';
import {getLogger} from 'log4js';

const SUPPORTED_RULE_TYPES = new Set(['cxx_binary', 'cxx_test']);
const LLDB_PROCESS_ID_REGEX = /lldb -p ([0-9]+)/;

export type NativeDebuggerService = {
  debugTargetFromBuckOutput: (
    buckRoot: NuclideUri,
    processStream: Observable<LegacyProcessMessage>,
  ) => Observable<BuckEvent>,
};

class Activation {
  _disposables: UniversalDisposable;

  constructor() {
    this._disposables = new UniversalDisposable();
    logger.setLevel(getConfig().clientLogLevel);
    (this: any).createNativeDebuggerService = this.createNativeDebuggerService.bind(
      this,
    );
    (this: any).provideLLDBPlatformGroup = this.provideLLDBPlatformGroup.bind(
      this,
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  createDebuggerProvider(): NuclideDebuggerProvider {
    return {
      name: 'lldb',
      getLaunchAttachProvider(
        connection: NuclideUri,
      ): ?DebuggerLaunchAttachProvider {
        return new LLDBLaunchAttachProvider('Native', connection);
      },
    };
  }

  createNativeDebuggerService(): NativeDebuggerService {
    const callback = this._waitForBuckThenDebugNativeTarget.bind(this);
    return {
      debugTargetFromBuckOutput(
        buckRoot: NuclideUri,
        processStream: Observable<LegacyProcessMessage>,
      ): Observable<BuckEvent> {
        return callback(buckRoot, processStream);
      },
    };
  }

  consumePlatformService(service: PlatformService): void {
    this._disposables.add(service.register(this.provideLLDBPlatformGroup));
  }

  provideLLDBPlatformGroup(
    buckRoot: NuclideUri,
    ruleType: string,
    buildTarget: string,
  ): Observable<?PlatformGroup> {
    if (!SUPPORTED_RULE_TYPES.has(ruleType)) {
      return Observable.of(null);
    }

    const availableActions = new Set(['build', 'run', 'test', 'debug']);
    return Observable.of({
      name: 'LLDB',
      platforms: [
        {
          isMobile: false,
          name: 'LLDB',
          tasksForBuildRuleType: buildRuleType => {
            return availableActions;
          },
          runTask: (builder, taskType, target, settings, device) => {
            const subcommand = taskType === 'debug' ? 'build' : taskType;
            if (taskType === 'debug') {
              return this._runDebugTask(
                builder,
                taskType,
                target,
                settings,
                device,
                buckRoot,
                ruleType,
              );
            } else {
              return builder.runSubcommand(
                buckRoot,
                subcommand,
                target,
                settings,
                false,
                null,
              );
            }
          },
        },
      ],
    });
  }

  _waitForBuckThenDebugNativeTarget(
    buckRoot: NuclideUri,
    processStream: Observable<LegacyProcessMessage>,
  ) {
    return processStream
      .flatMap(message => {
        if (message.kind !== 'stderr') {
          return Observable.empty();
        }

        const regMatch = message.data.match(LLDB_PROCESS_ID_REGEX);
        if (regMatch != null) {
          return Observable.of(regMatch[1]);
        }

        return Observable.empty();
      })
      .switchMap(attachArg => {
        return Observable.fromPromise(
          this._debugPidWithLLDB(parseInt(attachArg, 10), buckRoot),
        )
          .ignoreElements()
          .startWith({
            type: 'log',
            message: `Attaching LLDB debugger to pid ${attachArg}...`,
            level: 'info',
          });
      });
  }

  _runDebugTask(
    builder: BuckBuildSystem,
    taskType: TaskType,
    buildTarget: ResolvedBuildTarget,
    settings: TaskSettings,
    device: ?Device,
    buckRoot: NuclideUri,
    ruleType: string,
  ): Observable<TaskEvent> {
    invariant(taskType === 'debug');

    switch (ruleType) {
      case 'cxx_binary':
      case 'cxx_test':
        return builder.runSubcommand(
          buckRoot,
          'build',
          buildTarget,
          settings,
          false,
          null,
          (processStream: Observable<LegacyProcessMessage>) => {
            const buckService = getBuckServiceByNuclideUri(buckRoot);
            invariant(buckService != null);

            const {qualifiedName, flavors} = buildTarget;
            const separator = flavors.length > 0 ? '#' : '';
            const targetString = `${qualifiedName}${separator}${flavors.join(
              ',',
            )}`;
            const runArguments = settings.runArguments || [];
            const argString =
              runArguments.length === 0
                ? ''
                : ` with arguments "${runArguments.join(' ')}"`;
            return Observable.concat(
              processStream.ignoreElements(),
              Observable.defer(() =>
                this._debugBuckTarget(
                  buckService,
                  buckRoot,
                  targetString,
                  runArguments,
                ),
              )
                .ignoreElements()
                .map(path => ({
                  type: 'log',
                  message: `Launched debugger with ${path}`,
                  level: 'info',
                }))
                .catch(err => {
                  getLogger('nuclide-buck').error(
                    `Failed to launch debugger for ${targetString}`,
                    err,
                  );
                  return Observable.of({
                    type: 'log',
                    message: `Failed to launch debugger: ${err.message}`,
                    level: 'error',
                  });
                })
                .startWith(
                  {
                    type: 'log',
                    message: `Launching debugger for ${targetString}${argString}...`,
                    level: 'log',
                  },
                  {
                    type: 'progress',
                    progress: null,
                  },
                ),
            );
          },
        );
      default:
        invariant(false);
    }
  }

  async _getDebuggerService(): Promise<RemoteControlService> {
    return consumeFirstProvider('nuclide-debugger.remote');
  }

  async _debugPidWithLLDB(pid: number, buckRoot: string): Promise<void> {
    const attachInfo = await this._getAttachProcessInfoFromPid(pid, buckRoot);
    invariant(attachInfo);
    const debuggerService = await this._getDebuggerService();
    debuggerService.startDebugging(attachInfo);
  }

  async _getAttachProcessInfoFromPid(
    pid: number,
    buckProjectPath: string,
  ): Promise<?AttachProcessInfo> {
    const rpcService = getServiceByNuclideUri(
      'NativeDebuggerService',
      buckProjectPath,
    );
    invariant(rpcService);
    const attachTargetList = await rpcService.getAttachTargetInfoList(pid);
    if (attachTargetList.length === 0) {
      return null;
    }
    const attachTargetInfo = attachTargetList[0];
    attachTargetInfo.basepath = nuclideUri.getPath(buckProjectPath);
    return new AttachProcessInfo(buckProjectPath, attachTargetInfo);
  }

  async _debugBuckTarget(
    buckService: BuckService,
    buckRoot: string,
    buildTarget: string,
    runArguments: Array<string>,
  ): Promise<string> {
    const output = await buckService.showOutput(buckRoot, buildTarget);
    if (output.length === 0) {
      throw new Error(
        `Could not find build output path for target ${buildTarget}`,
      );
    }
    if (output.length > 1) {
      throw new Error(
        `Target ${buildTarget} is ambiguous. Please specify a single test.`,
      );
    }

    const targetOutput = output[0];
    const relativeOutputPath = targetOutput['buck.outputPath'];
    if (relativeOutputPath == null) {
      throw new Error(
        `Target ${buildTarget} does not have executable build output.`,
      );
    }

    // LaunchProcessInfo's arguments should be local to the remote directory.
    const remoteBuckRoot = nuclideUri.getPath(buckRoot);
    const remoteOutputPath = nuclideUri.getPath(
      nuclideUri.join(buckRoot, relativeOutputPath),
    );

    const env = [];
    if (targetOutput.env) {
      for (const key of Object.keys(targetOutput.env)) {
        // NOTE: no escaping is necessary here; LLDB passes these directly to the process.
        env.push(key + '=' + targetOutput.env[key]);
      }
    }

    const info = new LaunchProcessInfo(buckRoot, {
      executablePath: remoteOutputPath,
      // Allow overriding of a test's default arguments if provided.
      arguments: (runArguments.length ? runArguments : targetOutput.args) || [],
      environmentVariables: env,
      workingDirectory: remoteBuckRoot,
      basepath: remoteBuckRoot,
      lldbPythonPath: null,
    });

    const debuggerService = await this._getDebuggerService();
    await debuggerService.startDebugging(info);
    return remoteOutputPath;
  }
}

createPackage(module.exports, Activation);
