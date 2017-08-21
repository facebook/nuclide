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

import log4js from 'log4js';
import os from 'os';

import {
  FileAppender,
  getServerLogAppenderConfig,
  initialUpdateConfig,
} from '../../nuclide-logging';

const logger = log4js.getLogger('nuclide-remote-atom-rpc');

export const EXIT_CODE_SUCCESS = 0;
export const EXIT_CODE_UNKNOWN_ERROR = 1;
export const EXIT_CODE_APPLICATION_ERROR = 2;
export const EXIT_CODE_CONNECTION_ERROR = 3;
export const EXIT_CODE_INVALID_ARGUMENTS = 4;

export function setupErrorHandling() {
  process.on('uncaughtException', event => {
    logger.error(
      `Caught unhandled exception: ${event.message}`,
      event.originalError,
    );
    process.stderr.write(`Unhandled exception: ${event.message}\n`);
    process.exit(EXIT_CODE_UNKNOWN_ERROR);
  });

  process.on('unhandledRejection', (error, promise) => {
    logger.error('Caught unhandled rejection', error);
    process.stderr.write(`Unhandled rejection: ${error.message}\n`);
    process.exit(EXIT_CODE_UNKNOWN_ERROR);
  });
}

export function setupLogging() {
  // Initialize logging
  initialUpdateConfig();

  const config = {
    appenders: [FileAppender],
  };

  const serverLogAppenderConfig = getServerLogAppenderConfig();
  if (serverLogAppenderConfig) {
    config.appenders.push(serverLogAppenderConfig);
  }

  log4js.configure(config);
}

export function reportConnectionErrorAndExit(detailMessage: string): void {
  process.stderr.write(
    `Error connecting to nuclide-server on ${os.hostname()}:\n`,
  );
  process.stderr.write(`  ${detailMessage}.\n`);
  process.stderr.write('\n');
  process.stderr.write('Potential fixes:\n');
  process.stderr.write('* Ensure Atom with Nuclide is open.\n');
  process.stderr.write(
    `* Verify Nuclide's current directory located on ${os.hostname()}\n`,
  );
  process.stderr.write(
    '* Click the menu item "Nuclide/Kill Nuclide Server and Restart"\n',
  );
  process.stderr.write('\n');
  process.stderr.write('Callstack:\n');
  process.stderr.write(new Error().stack);
  process.stderr.write('\n');
  process.exit(EXIT_CODE_CONNECTION_ERROR);
}

export function reportErrorAndExit(error: Error, exitCode: number): void {
  process.stderr.write(error.stack);
  process.stderr.write('\n');
  process.exit(exitCode);
}
