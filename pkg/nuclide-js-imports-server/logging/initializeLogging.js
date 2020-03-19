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
import {setupLoggingService, getPathToLogDir} from '../../nuclide-logging';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {IConnection} from 'vscode-languageserver';

const MAX_LOG_SIZE = 16 * 1024;
const MAX_LOG_BACKUPS = 1;
const LOG_FILE_PATH = nuclideUri.join(
  getPathToLogDir(),
  'nuclide-js-imports-server.log',
);

// Configure log4js to not log to console, since
// writing arbitrary data to stdout will break JSON RPC if we're running over
// stdout.
//
// Additionally, add an appender to log over the rpc connection so logging appears
// in the client environment, independent of stdio, node rpc, socket, etc.
export default function initializeLogging(connection: IConnection) {
  setupLoggingService();
  log4js.configure({
    appenders: [
      {
        type: 'logLevelFilter',
        level: 'WARN',
        appender: {
          connection,
          type: require.resolve(
            '../../nuclide-lsp-implementation-common/connectionConsoleAppender',
          ),
        },
      },
    ],
  });

  // Don't let anything write to the true stdio as it could break JSON RPC
  global.console.log = connection.console.log.bind(connection.console);
  global.console.error = connection.console.error.bind(connection.console);
  catchUnhandledExceptions();
}

export function initializeLoggerForWorker(): void {
  // TODO: Ideally worker messages would go to the parent, which could send them back to the client.
  setupLoggingService();
  log4js.configure({
    appenders: [
      {
        type: 'logLevelFilter',
        level: 'DEBUG',
        appender: {
          type: 'file',
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
  catchUnhandledExceptions();
}

function catchUnhandledExceptions() {
  const logger = log4js.getLogger('js-imports-server');
  process.on('uncaughtException', e => {
    logger.error('uncaughtException', e);
    log4js.shutdown(() => process.abort());
  });
  process.on('unhandledRejection', e => logger.error('unhandledRejection', e));
}
