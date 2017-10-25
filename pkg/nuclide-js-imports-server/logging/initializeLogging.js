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
import nuclideUri from 'nuclide-commons/nuclideUri';
import os from 'os';
import {IConnection} from 'vscode-languageserver';

const MAX_LOG_SIZE = 1024 * 1024;
const MAX_LOG_BACKUPS = 10;
const LOG_FILE_PATH = nuclideUri.join(
  os.tmpdir(),
  'nuclide-js-imports-server.log',
);

// Configure log4js to not log to console, since
// writing arbitrary data to stdout will break JSON RPC if we're running over
// stdout.
//
// Additionally, add an appender to log over the rpc connection so logging appears
// in the client environment, independent of stdio, node rpc, socket, etc.
export default function initializeLogging(connection: IConnection) {
  log4js.configure({
    appenders: [
      {
        type: 'logLevelFilter',
        level: process.argv.includes('--debug') ? 'DEBUG' : 'WARN',
        appender: {
          type: nuclideUri.join(__dirname, 'fileAppender'),
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
      },
      {
        type: 'logLevelFilter',
        level: process.argv.includes('--debug') ? 'DEBUG' : 'INFO',
        appender: {
          connection,
          type: nuclideUri.join(__dirname, 'connectionConsoleAppender'),
        },
      },
    ],
  });

  // Don't let anything write to the true stdio as it could break JSON RPC
  global.console.log = connection.console.log.bind(connection.console);
  global.console.error = connection.console.error.bind(connection.console);

  const logger = log4js.getLogger();
  catchUnhandledExceptions(logger);
}

export function initializeLoggerForWorker(
  logLevel: 'DEBUG' | 'WARN',
): log4js$Logger {
  log4js.configure({
    appenders: [
      {
        type: 'logLevelFilter',
        level: logLevel,
        appender: {
          type: nuclideUri.join(__dirname, 'fileAppender'),
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
      },
    ],
  });

  const logger = log4js.getLogger();
  catchUnhandledExceptions(logger);
  return logger;
}

function catchUnhandledExceptions(logger: log4js$Logger) {
  process.on('uncaughtException', e => {
    logger.error('uncaughtException', e);
    log4js.shutdown(() => process.abort());
  });
  process.on('unhandledRejection', e => logger.error('unhandledRejection', e));
}
