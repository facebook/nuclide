/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import log4js from 'log4js';
import os from 'os';

import {trackImmediate} from 'nuclide-analytics';
import {initializeLogging} from '../../nuclide-logging';

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
  initializeLogging();
}

export async function trackSuccess(
  command: string,
  args: mixed,
): Promise<void> {
  await trackImmediate('nuclide-remote-atom-rpc:success', {command, args});
}

export async function trackError(
  command: string,
  args: mixed,
  error: Error,
): Promise<void> {
  await trackImmediate('nuclide-remote-atom-rpc:error', {
    command,
    args,
    error,
  });
}

export function reportConnectionErrorAndExit(
  error: FailedConnectionError,
): void {
  const detailMessage = error.message;
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

export function explainNuclideIsNeededAndExit(): void {
  process.stderr.write(
    'You need to have a Nuclide connection active. ' +
      "This command doesn't normally exist on Linux and is powered by Nuclide magic.\n",
  );
  process.exit(EXIT_CODE_CONNECTION_ERROR);
}

export function reportErrorAndExit(error: Error, exitCode: number): void {
  process.stderr.write(error.stack);
  process.stderr.write('\n');
  process.exit(exitCode);
}

export class FailedConnectionError extends Error {}
