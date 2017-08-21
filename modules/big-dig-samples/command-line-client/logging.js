/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import log4js from 'log4js';
import os from 'os';
// eslint-disable-next-line nuclide-internal/prefer-nuclide-uri
import path from 'path';

export function setupDefaultLogging(loggingFile: string) {
  log4js.configure({
    appenders: [
      {
        type: 'file',
        filename: path.join(os.tmpdir(), loggingFile),
      },
      {
        type: 'console',
      },
    ],
  });

  process.on('unhandledRejection', error => {
    log4js.getLogger().fatal('Unhandled rejection:', error);
    log4js.shutdown(() => process.exit(1));
  });

  process.on('uncaughtException', error => {
    log4js.getLogger().fatal('Uncaught exception:', error);
    log4js.shutdown(() => process.exit(1));
  });
}
