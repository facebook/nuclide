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

import {isRunningInTest} from 'nuclide-commons/system-info';

import os from 'os';
import {LOG_CATEGORY as PROCESS_LOG_CATEGORY} from 'nuclide-commons/process';
import nuclideUri from 'nuclide-commons/nuclideUri';

const LOG_DIRECTORY = nuclideUri.join(
  os.tmpdir(),
  `/nuclide-${os.userInfo().username}-logs`,
);
export const LOG_FILE_PATH = nuclideUri.join(LOG_DIRECTORY, 'nuclide.log');

const MAX_LOG_SIZE = 1024 * 1024;
const MAX_LOG_BACKUPS = 10;

export function getPathToLogDir(): string {
  return LOG_DIRECTORY;
}

export function getPathToLogFile(): string {
  return LOG_FILE_PATH;
}

export function getDefaultConfig(): log4js$Config {
  const appenders = [
    {
      type: require.resolve('../VendorLib/fileAppender'),
      filename: LOG_FILE_PATH,
      maxLogSize: MAX_LOG_SIZE,
      backups: MAX_LOG_BACKUPS,
      layout: {
        type: 'pattern',
        // Format log in following pattern:
        // yyyy-MM-dd HH:mm:ss.mil $Level (pid:$pid) $categroy - $message.
        pattern: `%d{ISO8601} %p (pid:${process.pid}) %c - %m`,
      },
    },
  ];
  // Anything not in Atom doesn't have a visible console.
  if (typeof atom === 'object') {
    appenders.push({
      type: 'logLevelFilter',
      level: 'WARN',
      appender: {
        type: require.resolve('./consoleAppender'),
      },
    });
    appenders.push({
      type: 'logLevelFilter',
      level: 'ALL',
      appender: {
        type: require.resolve('./nuclideConsoleAppender'),
      },
    });
  } else {
    // Make sure FATAL errors make it to stderr.
    appenders.push({
      type: 'logLevelFilter',
      level: 'FATAL',
      appender: {
        type: require.resolve('./consoleAppender'),
        stderr: true,
      },
    });
  }
  if (!isRunningInTest()) {
    appenders.push({
      type: require.resolve('./processTrackingAppender'),
      category: PROCESS_LOG_CATEGORY,
    });
    try {
      const scribeAppenderPath = require.resolve('../fb/scribeAppender');
      appenders.push({
        type: 'logLevelFilter',
        // Anything less than ERROR is ignored by the backend anyway.
        level: 'ERROR',
        appender: {
          type: scribeAppenderPath,
          scribeCategory: 'errorlog_arsenal',
        },
      });
    } catch (err) {
      // We're running in open-source: ignore.
    }
  }
  return {appenders};
}
