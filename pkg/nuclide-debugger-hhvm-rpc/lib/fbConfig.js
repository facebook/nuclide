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

import type {HHVMLaunchConfig} from './types';

import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';

export const DEVSERVER_HHVM_PATH = '/usr/local/hphpi/bin/hhvm';

export function getHHVMRuntimeArgs(
  launchConfig: HHVMLaunchConfig,
): Array<string> {
  if (launchConfig.hhvmRuntimeArgs.some(s => s === '-c' || s === '--config')) {
    return launchConfig.hhvmRuntimeArgs;
  }

  return ['-c', '/usr/local/hphpi/cli.hdf'].concat(
    ...launchConfig.hhvmRuntimeArgs,
  );
}

export async function getHhvmStackTraces(): Promise<Array<string>> {
  const STACK_TRACE_LOCATION = '/var/tmp/cores/';
  const STACK_TRACE_PATTERN = /stacktrace\..+\.log/;
  const fileNames = await fsPromise.readdir(STACK_TRACE_LOCATION);
  return fileNames
    .filter(fileName => STACK_TRACE_PATTERN.exec(fileName) != null)
    .map(fileName => nuclideUri.join(STACK_TRACE_LOCATION, fileName));
}

export function getRestartInstructions(): string {
  return (
    'Nuclide was unable to connect to your HHVM instance. Please wait ' +
    'a few moments and try again. If your webserver instance is still not ' +
    'responding, you can run `sudo webserver restart` from a terminal to restart it.'
  );
}
