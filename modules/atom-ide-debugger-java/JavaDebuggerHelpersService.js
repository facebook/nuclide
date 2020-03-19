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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {VSAdapterExecutableInfo} from 'nuclide-debugger-common';

import {track} from 'nuclide-commons/analytics';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import os from 'os';
import {runCommand} from 'nuclide-commons/process';
import {getAvailableServerPort} from 'nuclide-commons/serverPort';

export type JavaLaunchTargetConfig = {|
  +debugMode: 'launch',
  +entryPointClass: string,
  +classPath: string,
  +runArgs?: ?Array<string>,
|};

export type JavaAttachPortTargetConfig = {|
  +debugMode: 'attach',
  +machineName: string,
  +port: number,
  +packageName: string,
  +deviceSerial: string,
|};

export type JavaTargetConfig =
  | JavaLaunchTargetConfig
  | JavaAttachPortTargetConfig;

export type TerminalLaunchInfo = {|
  +launchCommand: string,
  +launchCwd: NuclideUri,
  +targetExecutable: NuclideUri,
  +launchArgs: Array<string>,
  +attachPort: number,
  +attachHost: string,
|};

const JAVA = 'java';

export async function getPortForJavaDebugger(): Promise<number> {
  return getAvailableServerPort();
}

export async function getJavaVSAdapterExecutableInfo(
  debug: boolean,
): Promise<VSAdapterExecutableInfo> {
  return {
    command: JAVA,
    args: await _getJavaArgs(debug),
  };
}

async function _getJavaArgs(debug: boolean): Promise<Array<string>> {
  const baseJavaArgs = [
    '-classpath',
    await _getClassPath(),
    'com.facebook.nuclide.debugger.JavaDbg',
  ];
  const debugArgs = debug
    ? [
        '-Xdebug',
        '-Xrunjdwp:transport=dt_socket,address=127.0.0.1:' +
          (await getAvailableServerPort()).toString() +
          ',server=y,suspend=n',
      ]
    : [];
  return debugArgs.concat(baseJavaArgs);
}

async function _getClassPath(): Promise<string> {
  const serverJarPath = nuclideUri.join(
    __dirname,
    'Build',
    'java_debugger_server.jar',
  );

  if (!(await fsPromise.exists(serverJarPath))) {
    throw new Error(
      `Could not locate the java debugger server jar: ${serverJarPath}. ` +
        'Please check your Nuclide installation.',
    );
  }

  // Determining JDK lib path varies by platform.
  let toolsJarPath;
  switch (os.platform()) {
    case 'win32':
      toolsJarPath = (process.env.JAVA_HOME || '') + '\\lib\\tools.jar';

      break;
    case 'linux': {
      // Find java
      const java = (await runCommand('which', ['java']).toPromise()).trim();
      const javaHome = await fsPromise.realpath(java);

      // $FlowFixMe (>= v0.75.0)
      const matches: RegExp$matchResult = /(.*)\/java/.exec(javaHome);
      toolsJarPath = matches.length > 1 ? matches[1] + '/../lib/tools.jar' : '';
      break;
    }
    case 'darwin':
    default: {
      const javaHome = (await runCommand(
        '/usr/libexec/java_home',
      ).toPromise()).trim();
      toolsJarPath = javaHome + '/lib/tools.jar';

      break;
    }
  }
  if (!(await fsPromise.exists(toolsJarPath))) {
    // Tools.jar is not expected on Java 10+ and is not required.
    return serverJarPath;
  }
  return nuclideUri.joinPathList([serverJarPath, toolsJarPath]);
}

export async function getSdkVersionSourcePath(
  sdkVersion: string,
  options: {useSdkManager: boolean},
): Promise<?NuclideUri> {
  if (Number.isNaN(parseInt(sdkVersion, 10))) {
    return null;
  }

  // First try process.env.ANDROID_HOME
  // Then try /opt/android/sdk_DXXXXXXX which is the remote case.
  // Then try /opt/android_sdk which is the local case

  let androidHomeDir = (process.env.ANDROID_HOME: ?string);
  let sourcesDirectory = await _getSdkVersionSourcePath(
    androidHomeDir,
    sdkVersion,
    {useSdkManager: options.useSdkManager},
  );
  if (sourcesDirectory != null) {
    return sourcesDirectory;
  }

  androidHomeDir = null;
  const remoteAndroidHomeDirDir = '/opt/android/';
  if (await fsPromise.exists(remoteAndroidHomeDirDir)) {
    const children = await fsPromise.readdir(remoteAndroidHomeDirDir);
    const sdkDirs = children.filter(c => c.startsWith('sdk_D'));
    const sdkDirStats = await Promise.all(
      sdkDirs.map(d =>
        fsPromise.stat(nuclideUri.join(remoteAndroidHomeDirDir, d)),
      ),
    );
    const sdkDirTimes = sdkDirStats.map(s => s.mtime.getTime());
    const sortedSdkDirs = sdkDirs
      .map((d, i) => [d, sdkDirTimes[i]])
      .sort((a, b) => b[1] - a[1]);
    if (sortedSdkDirs.length > 0) {
      androidHomeDir = nuclideUri.join(
        remoteAndroidHomeDirDir,
        sortedSdkDirs[0][0],
      );
    }
  }

  sourcesDirectory = await _getSdkVersionSourcePath(
    androidHomeDir,
    sdkVersion,
    {useSdkManager: false},
  );
  if (sourcesDirectory != null) {
    return sourcesDirectory;
  }

  androidHomeDir = '/opt/android_sdk';
  sourcesDirectory = await _getSdkVersionSourcePath(
    androidHomeDir,
    sdkVersion,
    {useSdkManager: options.useSdkManager},
  );
  if (sourcesDirectory != null) {
    return sourcesDirectory;
  }

  return null;
}

async function _getSdkVersionSourcePath(
  androidHomeDir: ?string,
  sdkVersion: string,
  options: {useSdkManager: boolean},
): Promise<?NuclideUri> {
  if (androidHomeDir != null && androidHomeDir !== '') {
    const sourcesDirectory = nuclideUri.join(
      androidHomeDir,
      'sources',
      'android-' + sdkVersion,
    );

    if (await fsPromise.exists(sourcesDirectory)) {
      return sourcesDirectory;
    }

    const sdkManagerPath = nuclideUri.join(
      androidHomeDir,
      'tools/bin/sdkmanager',
    );

    if (options.useSdkManager && (await fsPromise.exists(sdkManagerPath))) {
      try {
        await runCommand(sdkManagerPath, ['sources;android-' + sdkVersion])
          .timeout(30000)
          .toPromise();
        // try again
        const sourcesDirectoryExists = await fsPromise.exists(sourcesDirectory);
        track('atom-ide-debugger-java-installSdkSourcesUsingSdkManager', {
          sourcesDirectoryExists,
          sourcesDirectory,
          sdkManagerPath,
        });
        if (sourcesDirectoryExists) {
          return sourcesDirectory;
        }
      } catch (err) {
        track('atom-ide-debugger-java-installSdkSourcesUsingSdkManager-error', {
          sourcesDirectoryExists: false,
          sourcesDirectory,
          sdkManagerPath,
          errMessage: err.toString(),
        });
      }
    }
  }
  return null;
}
