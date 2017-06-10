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

import type {PhpDebuggerSessionConfig} from '../../nuclide-debugger-php-rpc';

import invariant from 'assert';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {getLogger} from 'log4js';

const DEBUGGER_LOGGER_CATEGORY = 'nuclide-debugger-php';
export default getLogger(DEBUGGER_LOGGER_CATEGORY);

export function getConfig(): PhpDebuggerSessionConfig {
  return (featureConfig.get('nuclide-debugger-php'): any);
}

// TODO: Move this to nuclide-commons.
export function isValidRegex(value: ?string): boolean {
  if (value == null) {
    return false;
  }
  try {
    RegExp(value);
  } catch (e) {
    return false;
  }
  return true;
}

function validateConfig(config): void {
  const {attachScriptRegex} = config;
  if (!isValidRegex(attachScriptRegex)) {
    invariant(attachScriptRegex != null);
    throw Error(
      `config scriptRegex is not a valid regular expression: ${attachScriptRegex}`,
    );
  }

  if (!isValidRegex(config.idekeyRegex)) {
    invariant(config.idekeyRegex != null);
    throw Error(
      `config idekeyRegex is not a valid regular expression: ${config.idekeyRegex}`,
    );
  }
}

export function getSessionConfig(
  targetUri: string,
  isLaunch: boolean,
): PhpDebuggerSessionConfig {
  const config = getConfig();
  validateConfig(config);
  const sessionConfig: PhpDebuggerSessionConfig = {
    xdebugAttachPort: config.xdebugAttachPort,
    xdebugLaunchingPort: config.xdebugLaunchingPort,
    targetUri,
    logLevel: config.logLevel,
    endDebugWhenNoRequests: false,
    phpRuntimePath: config.phpRuntimePath,
    phpRuntimeArgs: config.phpRuntimeArgs,
    dummyRequestFilePath: 'php_only_xdebug_request.php',
    stopOneStopAll: config.stopOneStopAll,
    attachScriptRegex: config.attachScriptRegex,
    idekeyRegex: config.idekeyRegex,
  };
  if (isLaunch) {
    sessionConfig.xdebugAttachPort = config.xdebugLaunchingPort;
  }
  return sessionConfig;
}
