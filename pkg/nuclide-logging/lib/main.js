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

/**
 * This designed for logging on both Nuclide client and Nuclide server. It is based on [log4js]
 * (https://www.npmjs.com/package/log4js) with the ability to lazy initialize and update config
 * after initialized.
 * To make sure we only have one instance of log4js logger initialized globally, we save the logger
 * to `global` object.
 */

import log4js from 'log4js';

import once from '../../commons-node/once';
import {
  getDefaultConfig,
  getPathToLogFile,
  FileAppender,
  getServerLogAppenderConfig,
} from './config';

export {
  getDefaultConfig,
  getPathToLogFile,
  FileAppender,
  getServerLogAppenderConfig,
};

export function flushLogsAndExit(exitCode: number): void {
  log4js.shutdown(() => process.exit(exitCode));
}

export function flushLogsAndAbort(): void {
  log4js.shutdown(() => process.abort());
}

/**
 * Push initial default config to log4js.
 * Execute only once.
 */
export const initialUpdateConfig = once(() => {
  log4js.configure(getDefaultConfig());
});

export function initializeLogging() {
  initialUpdateConfig();
}
