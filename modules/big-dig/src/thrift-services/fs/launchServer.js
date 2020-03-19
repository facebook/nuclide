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

import log4js from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';
import os from 'os';
import {RemoteFileSystemServer} from './fsServer';

async function main() {
  if (process.argv.length !== 3) {
    // eslint-disable-next-line no-console
    console.error('Error: launchServer expected port as parameter.');
    process.exit(1);
  }

  const portOrPath = process.argv[2];
  log4js.getLogger().info('Initializing server on ', portOrPath);
  const server = new RemoteFileSystemServer(portOrPath);
  await server.initialize();
  log4js.getLogger().info('Server listening on ', portOrPath);
}

log4js.configure({
  appenders: [
    {
      type: 'file',
      filename: nuclideUri.join(os.tmpdir(), 'big-dig-service-fs.log'),
    },
    {
      type: 'stderr',
    },
  ],
});

process.on('unhandledRejection', error => {
  log4js.getLogger().error('Unhandled rejection:', error);
});

process.on('uncaughtException', error => {
  log4js.getLogger().fatal('Uncaught exception:', error);
  log4js.shutdown(() => process.abort());
});

main();
