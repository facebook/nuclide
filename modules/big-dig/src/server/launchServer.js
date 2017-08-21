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

import invariant from 'assert';
import log4js from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';
import os from 'os';
import {launchServer} from './NuclideServer';

async function main() {
  const params = JSON.parse(process.argv[2]);
  // TODO(mbolin): Do basic runtime validation on params.

  const port = await launchServer({
    port: params.port,
    webServer: {
      key: params.key,
      cert: params.cert,
      ca: params.ca,
    },
    absolutePathToServerMain: params.launcher,
    serverParams: params.serverParams,
  });

  // $FlowIgnore
  process.send({port}, () => {
    invariant(process.disconnect);
    process.disconnect();
  });
}

log4js.configure({
  appenders: [
    {
      type: 'file',
      filename: nuclideUri.join(os.tmpdir(), 'big-dig.log'),
    },
    {
      type: 'console',
    },
  ],
});

main();

process.on('unhandledRejection', error => {
  log4js.getLogger().fatal('Unhandled rejection:', error);
  log4js.shutdown(() => process.exit(1));
});

process.on('uncaughtException', error => {
  log4js.getLogger().fatal('Uncaught exception:', error);
  log4js.shutdown(() => process.exit(1));
});
