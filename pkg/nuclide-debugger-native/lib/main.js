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
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {VsAdapterType} from 'nuclide-debugger-common';
import type {PlatformService} from '../../nuclide-buck/lib/PlatformService';
import type {PlatformGroup} from '../../nuclide-buck/lib/types';
import {getDebuggerService} from 'nuclide-commons-atom/debugger';
import typeof * as BuckService from '../../nuclide-buck-rpc';
import type {BuckBuildSystem} from '../../nuclide-buck/lib/BuckBuildSystem';
import type {TaskSettings, TaskType} from '../../nuclide-buck/lib/types';
import type {TaskEvent} from 'nuclide-commons/process';
import type {ResolvedBuildTarget} from '../../nuclide-buck-rpc/lib/types';
import type {BuckEvent} from '../../nuclide-buck/lib/BuckEventStream';

import createPackage from 'nuclide-commons-atom/createPackage';
import {Observable} from 'rxjs';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {
  isDebugTask,
  getBuckSubcommandForTaskType,
} from '../../nuclide-buck/lib/BuckTaskRunner';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import invariant from 'assert';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {
  getNativeVSPLaunchProcessConfig,
  getNativeVSPAttachProcessConfig,
} from '../../nuclide-debugger-vsp/lib/utils';
import {VsAdapterTypes, VsAdapterNames} from 'nuclide-debugger-common';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getFileSystemServiceByNuclideUri} from '../../nuclide-remote-connection';
import {getBuckServiceByNuclideUri} from '../../nuclide-remote-connection';
import {getLogger} from 'log4js';
import passesGK from 'nuclide-commons/passesGK';

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
    const underlyingRuleType = this._getUnderlyingRuleType(
      ruleType,
      buildTarget,
    );
    if (!SUPPORTED_RULE_TYPES.has(underlyingRuleType)) {
      return Observable.of(null);
    }

    const availableActions = new Set([
      'build',
      'run',
      'test',
      'build-launch-debug',
      'launch-debug',
      'attach-debug',
    ]);
    return Observable.of({
      name: 'Native',
      platforms: [
        {
          isMobile: false,
          name: 'LLDB',
          tasksForBuildRuleType: buildRuleType => {
            return availableActions;
          },
          runTask: (builder, taskType, target, settings) => {
            const subcommand =
              taskType === 'build-launch-debug' ? 'build' : taskType;
            if (isDebugTask(taskType)) {
              return this._runDebugTask(
                builder,
                taskType,
                target,
                settings,
                buckRoot,
                underlyingRuleType,
              );
            } else {
              return builder.runSubcommand(
                buckRoot,
                getBuckSubcommandForTaskType(subcommand),
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

  _getUnderlyingRuleType(ruleType: string, buildTarget: string): string {
    if (ruleType === 'apple_binary' && buildTarget.endsWith('AppleMac')) {
      return 'cxx_binary';
    } else {
      return ruleType;
    }
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
    taskSettings: TaskSettings,
    buckRoot: NuclideUri,
    ruleType: string,
  ): Observable<TaskEvent> {
    if (taskType === 'attach-debug') {
      // TODO: The implementation below is annoying/wrong
      // It redirects to the attach dialog, ignores the buildTarget input and asks user to choose what they want to attach to.
      // Instead it should automatically figure out the process based on buildTarget and attach to it.
      return Observable.defer(async () => {
        const providerType = await this._getBuckNativeDebugAdapterType();
        atom.commands.dispatch(
          atom.views.getView(atom.workspace),
          'debugger:show-attach-dialog',
          {
            selectedTabName:
              providerType === VsAdapterTypes.NATIVE_GDB
                ? VsAdapterNames.NATIVE_GDB
                : VsAdapterNames.NATIVE_LLDB,
            config: {sourcePath: nuclideUri.getPath(buckRoot)},
          },
        );
      }).ignoreElements();
    }

    const buckService = getBuckServiceByNuclideUri(buckRoot);
    invariant(buckService != null);

    const {qualifiedName, flavors} = buildTarget;
    const separator = flavors.length > 0 ? '#' : '';
    const targetString = `${qualifiedName}${separator}${flavors.join(',')}`;
    const runArguments = taskSettings.runArguments || [];

    const argString =
      runArguments.length === 0
        ? ''
        : ` with arguments "${runArguments.join(' ')}"`;

    const debugBuckTarget = Observable.defer(() =>
      this._debugBuckTarget(
        buckService,
        buckRoot,
        targetString,
        taskSettings.buildArguments || [],
        runArguments,
      ),
    )
      .ignoreElements()
      .catch(err => {
        getLogger('nuclide-buck').error(
          `Failed to launch debugger for ${targetString}`,
          err,
        );
        return Observable.of({
          type: 'message',
          message: {
            level: 'error',
            text: `Failed to launch debugger: ${err.message}`,
          },
        });
      })
      .startWith(
        {
          type: 'message',
          message: {
            level: 'log',
            text: `Launching debugger for ${targetString}${argString}...`,
          },
        },
        {
          type: 'progress',
          progress: null,
        },
      );

    if (taskType === 'launch-debug') {
      return debugBuckTarget;
    }

    invariant(taskType === 'build-launch-debug');
    return this._addModeDbgIfNoModeInBuildArguments(
      buckRoot,
      taskSettings,
    ).switchMap(settings => {
      switch (ruleType) {
        case 'cxx_binary':
        case 'cxx_test':
          return builder
            .runSubcommand(
              buckRoot,
              'build',
              buildTarget,
              settings,
              false,
              null,
            )
            .ignoreElements()
            .concat(debugBuckTarget);
        default:
          invariant(false);
      }
    });
  }

  async _debugPidWithLLDB(pid: number, buckRoot: string): Promise<void> {
    const config = getNativeVSPAttachProcessConfig(
      VsAdapterTypes.NATIVE_LLDB,
      buckRoot,
      {
        pid,
        sourcePath: nuclideUri.getPath(buckRoot),
        debuggerRoot: nuclideUri.getPath(buckRoot),
      },
    );
    const debuggerService = await getDebuggerService();
    debuggerService.startVspDebugging(config);
  }

  async _debugBuckTarget(
    buckService: BuckService,
    buckRoot: string,
    buildTarget: string,
    buildArguments: Array<string>,
    runArguments: Array<string>,
  ): Promise<string> {
    const output = await buckService.showOutput(
      buckRoot,
      buildTarget,
      buildArguments,
    );
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

    // launch config's arguments should be local to the remote directory.
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

    const config = await getNativeVSPLaunchProcessConfig(
      await this._getBuckNativeDebugAdapterType(),
      nuclideUri.join(buckRoot, relativeOutputPath),
      {
        args: (runArguments.length ? runArguments : targetOutput.args) || [],
        cwd: remoteBuckRoot,
        env,
        sourcePath: remoteBuckRoot,
        debuggerRoot: remoteBuckRoot,
      },
    );
    const debuggerService = await getDebuggerService();
    await debuggerService.startVspDebugging(config);
    return remoteOutputPath;
  }

  async _getBuckNativeDebugAdapterType(): Promise<VsAdapterType> {
    if (await passesGK('nuclide_buck_uses_gdb')) {
      return VsAdapterTypes.NATIVE_GDB;
    } else {
      return VsAdapterTypes.NATIVE_LLDB;
    }
  }

  _addModeDbgIfNoModeInBuildArguments(
    buckRoot: NuclideUri,
    settings: TaskSettings,
  ): Observable<TaskSettings> {
    const buildArguments =
      settings.buildArguments != null ? settings.buildArguments : [];
    if (buildArguments.some(arg => arg.includes('@mode'))) {
      return Observable.of(settings);
    }

    const fileSystemService = getFileSystemServiceByNuclideUri(buckRoot);
    return Observable.defer(async () => {
      const modeDbgFile = nuclideUri.join(buckRoot, 'mode', 'dbg');
      if (await fileSystemService.exists(modeDbgFile)) {
        buildArguments.push('@mode/dbg');
        return {
          buildArguments,
          runArguments: settings.runArguments,
        };
      } else {
        return settings;
      }
    });
  }
}

createPackage(module.exports, Activation);
