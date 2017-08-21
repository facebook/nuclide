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
import nuclideUri from 'nuclide-commons/nuclideUri';
import os from 'os';
import {getUsername} from '../common/username';
import {generateCertificatesAndStartServer} from './main';

log4js.configure({
  appenders: [
    {
      type: 'file',
      filename: nuclideUri.join(os.tmpdir(), 'big-dig-cli.log'),
    },
    {
      type: 'console',
    },
  ],
});

const DEFAULT_PORT = 0;

/**
 * @param absolutePathToServerMain The code that bootstraps the server will load the code at this
 *     path via require(). It is expected to have a default export that is a function that takes the
 *     WebSocket server created by Big Dig, along with other arguments, and starts the main
 *     server [that is using Big Dig as a building block].
 */
export async function parseArgsAndRunMain(absolutePathToServerMain: string) {
  const params = JSON.parse(process.argv[2]);
  const {cname, expiration, jsonOutputFile} = params;
  let {port} = params;
  if (typeof cname !== 'string') {
    throw Error(`cname must be specified as string but was: '${cname}'`);
  }
  if (typeof jsonOutputFile !== 'string') {
    throw Error('Must specify jsonOutputFile');
  }

  // port arg validation
  if (port == null) {
    port = DEFAULT_PORT;
  }
  if (typeof port !== 'number') {
    throw Error(`port must be specified as number but was: '${port}'`);
  }
  // eslint-disable-next-line no-bitwise
  if ((port | 0) !== port) {
    throw Error(`port must be an integer but was: '${port}'`);
  }
  if (port < 0) {
    throw Error(`port must be >=0 but was ${port}`);
  }

  // expiration arg validation
  if (typeof expiration !== 'string') {
    throw Error(
      `expiration must be specified as string but was: '${expiration}'`,
    );
  }
  const expirationMatch = expiration.match(/^(\d+)d$/);
  if (expirationMatch == null) {
    throw Error(`expiration must be /(\\d+)d/ but was: '${expiration}'`);
  }
  const expirationDays = parseInt(expirationMatch[1], 10);
  if (expirationDays <= 0) {
    throw Error(`expiration must be >0 but was ${expirationDays}`);
  }

  const clientCommonName = 'nuclide';
  const serverCommonName = cname || `${getUsername()}.nuclide.${os.hostname()}`;
  const openSSLConfigPath = require.resolve('./openssl.cnf');

  await generateCertificatesAndStartServer(
    clientCommonName,
    serverCommonName,
    openSSLConfigPath,
    port,
    expirationDays,
    jsonOutputFile,
    absolutePathToServerMain,
    params.serverParams,
  );
}
