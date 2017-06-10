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
import typeof * as BuckService from '../../nuclide-buck-rpc';
import type RemoteControlService
  from '../../nuclide-debugger/lib/RemoteControlService';
import type {BuckEvent} from './BuckEventStream';

import invariant from 'assert';
import {Observable} from 'rxjs';

import {compact} from 'nuclide-commons/observable';
import consumeFirstProvider from '../../commons-atom/consumeFirstProvider';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {
  AttachProcessInfo,
} from '../../nuclide-debugger-native/lib/AttachProcessInfo';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {
  LaunchProcessInfo,
} from '../../nuclide-debugger-native/lib/LaunchProcessInfo';
import {getLogger} from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';
import {track} from '../../nuclide-analytics';

const LLDB_PROCESS_ID_REGEX = /lldb -p ([0-9]+)/;
const JDWP_PROCESS_PORT_REGEX = /.*Connect a JDWP debugger to port ([0-9]+).*/;
const ANDROID_ACTIVITY_REGEX = /Starting activity (.*)\/(.*)\.\.\./;
const ANDROID_DEVICE_REGEX = /Installing apk on ([^ ]+).*/;
const LLDB_TARGET_TYPE = 'LLDB';
const ANDROID_TARGET_TYPE = 'android';

async function getDebuggerService(): Promise<RemoteControlService> {
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'nuclide-debugger:show',
  );
  return consumeFirstProvider('nuclide-debugger.remote');
}

async function debugBuckTarget(
  buckService: BuckService,
  buckRoot: string,
  buildTarget: string,
  runArguments: Array<string>,
  targetType: string,
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

  const debuggerService = await getDebuggerService();
  await debuggerService.startDebugging(info);
  return remoteOutputPath;
}

async function debugPidWithLLDB(pid: number, buckRoot: string) {
  const attachInfo = await _getAttachProcessInfoFromPid(pid, buckRoot);
  invariant(attachInfo);
  const debuggerService = await getDebuggerService();
  debuggerService.startDebugging(attachInfo);
}

async function debugJavaTest(attachPort: number, buckRoot: string) {
  const javaDebuggerProvider = await consumeFirstProvider(
    'nuclide-java-debugger',
  );

  if (javaDebuggerProvider == null) {
    throw new Error(
      'Could not debug java_test: the Java debugger is not available.',
    );
  }

  // Buck is going to invoke the test twice - once with --dry-run to determine
  // what tests are being run, and once to actually run the test. We need to
  // attach the debugger and resume the first instance, and then wait for the
  // second instance and re-attach.

  const debuggerService = await getDebuggerService();
  invariant(debuggerService != null);

  debuggerService.startDebugging(
    javaDebuggerProvider.createJavaTestAttachInfo(buckRoot, attachPort),
  );
}

async function debugAndroidActivity(
  buckProjectPath: string,
  androidPackage: string,
  deviceName: ?string,
) {
  const service = getServiceByNuclideUri(
    'JavaDebuggerService',
    buckProjectPath,
  );
  if (service == null) {
    throw new Error('Java debugger service is not available.');
  }

  const debuggerService = await getDebuggerService();
  track('fb-java-debugger-start', {
    startType: 'buck-toolbar',
    target: buckProjectPath,
    targetType: 'android',
    targetClass: androidPackage,
  });

  const javaDebugger = await consumeFirstProvider('nuclide-java-debugger');

  if (javaDebugger != null) {
    const debugInfo = javaDebugger.createAndroidDebugInfo({
      targetUri: buckProjectPath,
      packageName: androidPackage,
      device: deviceName,
    });
    debuggerService.startDebugging(debugInfo);
  }
}

async function _getAttachProcessInfoFromPid(
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

export function getDeployBuildEvents(
  processStream: Observable<LegacyProcessMessage>, // TODO(T17463635)
  buckService: BuckService,
  buckRoot: string,
  buildTarget: string,
  runArguments: Array<string>,
  targetType: string,
): Observable<BuckEvent> {
  const argString = runArguments.length === 0
    ? ''
    : ` with arguments "${runArguments.join(' ')}"`;
  return processStream
    .filter(message => message.kind === 'exit' && message.exitCode === 0)
    .switchMap(() => {
      return Observable.fromPromise(
        debugBuckTarget(
          buckService,
          buckRoot,
          buildTarget,
          runArguments,
          targetType,
        ),
      )
        .map(path => ({
          type: 'log',
          message: `Launched debugger with ${path}`,
          level: 'info',
        }))
        .catch(err => {
          getLogger('nuclide-buck').error(
            `Failed to launch debugger for ${buildTarget}`,
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
            message: `Launching debugger for ${buildTarget}${argString}...`,
            level: 'log',
          },
          {
            type: 'progress',
            progress: null,
          },
        );
    });
}

export function getDeployInstallEvents(
  processStream: Observable<LegacyProcessMessage>, // TODO(T17463635)
  buckRoot: string,
): Observable<BuckEvent> {
  let targetType = LLDB_TARGET_TYPE;
  let deviceName = null;
  return compact(
    processStream.map(message => {
      if (message.kind === 'stdout' || message.kind === 'stderr') {
        const deviceMatch = message.data.match(ANDROID_DEVICE_REGEX);
        if (deviceMatch != null && deviceMatch.length > 0) {
          deviceName = deviceMatch[1];
        }

        const activity = message.data.match(ANDROID_ACTIVITY_REGEX);
        if (activity != null) {
          targetType = ANDROID_TARGET_TYPE;
          return {targetType, targetApp: activity[1]};
        }

        const pidMatch = message.data.match(LLDB_PROCESS_ID_REGEX);
        if (pidMatch != null) {
          return {targetType, targetApp: pidMatch[1]};
        }
      }
    }),
  )
    .take(1)
    .switchMap(targetInfo => {
      return processStream
        .filter(message => message.kind === 'exit' && message.exitCode === 0)
        .switchMap(() => {
          if (targetInfo.targetType === LLDB_TARGET_TYPE) {
            return Observable.fromPromise(
              debugPidWithLLDB(parseInt(targetInfo.targetApp, 10), buckRoot),
            )
              .ignoreElements()
              .startWith({
                type: 'log',
                message: `Attaching LLDB debugger to pid ${targetInfo.targetApp}...`,
                level: 'info',
              });
          } else if (targetInfo.targetType === ANDROID_TARGET_TYPE) {
            return Observable.fromPromise(
              debugAndroidActivity(buckRoot, targetInfo.targetApp, deviceName),
            )
              .ignoreElements()
              .startWith({
                type: 'log',
                message: `Attaching Java debugger to pid ${targetInfo.targetApp}...`,
                level: 'info',
              });
          }

          return Observable.throw(new Error('Unexpected target type'));
        });
    });
}

export function getDeployTestEvents(
  processStream: Observable<LegacyProcessMessage>, // TODO(T17463635)
  buckRoot: string,
  targetType: string,
): Observable<BuckEvent> {
  let attachArgRegex;
  switch (targetType) {
    case 'java_test':
      attachArgRegex = JDWP_PROCESS_PORT_REGEX;
      break;
    default:
      attachArgRegex = LLDB_PROCESS_ID_REGEX;
      break;
  }

  return processStream
    .flatMap(message => {
      if (message.kind !== 'stderr') {
        return Observable.empty();
      }

      const regMatch = message.data.match(attachArgRegex);
      if (regMatch != null) {
        return Observable.of(regMatch[1]);
      }

      return Observable.empty();
    })
    .switchMap(attachArg => {
      let debugMsg;
      let debugObservable;
      switch (targetType) {
        case 'java_test':
          debugMsg = `Attaching Java debugger to port ${attachArg}...`;
          debugObservable = Observable.fromPromise(
            debugJavaTest(parseInt(attachArg, 10), buckRoot),
          );
          break;
        default:
          debugMsg = `Attaching LLDB debugger to pid ${attachArg}...`;
          debugObservable = Observable.fromPromise(
            debugPidWithLLDB(parseInt(attachArg, 10), buckRoot),
          );
          break;
      }

      return debugObservable.ignoreElements().startWith({
        type: 'log',
        message: debugMsg,
        level: 'info',
      });
    });
}
