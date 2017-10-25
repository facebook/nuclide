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

import BigDigServer from './BigDigServer';
import WS from 'ws';
import https from 'https';

export type LauncherParameters = {
  server: BigDigServer,
  // Any sort of JSON-serializable object is fine.
  serverParams: mixed,
};

export type NuclideServerOptions = {
  // These options will be passed verbatim to https.createServer(). Admittedly,
  // this is not the complete list of options that it takes, but these are the
  // ones we intentionally work with.
  webServer: {
    // Optional private keys in PEM format.
    key?: string | Array<string> | Buffer | Array<Buffer>,
    // Optional cert chains in PEM format
    cert?: string | Array<string> | Buffer | Array<Buffer>,
    // Optionally override the trusted CA certificates.
    ca?: string | Array<string> | Buffer | Array<Buffer>,
  },
  port: number,
  absolutePathToServerMain: string,
  // Any sort of JSON-serializable object is fine.
  serverParams: mixed,
};

/**
 * Launch a NuclideServer with the specified parameters.
 *
 * One common this may fail is if the specified port is in use. The caller is responsible for
 * checking for this failure and retrying on a different port.
 *
 * The best way to avoid this is by specifying a port of 0, though that may not be an option if the
 * host machine does not allow HTTP traffic to be served on an arbitrary port.
 * Note that if options.port=0 is specified to choose an ephemeral port, then the caller should
 * check server.address().port to see what the actual port is.
 */
export function launchServer(options: NuclideServerOptions): Promise<number> {
  const webServer = https.createServer(options.webServer);

  return new Promise((resolve, reject) => {
    // TODO(mbolin): Once the webServer is up and running and this Promise is resolved,
    // rejecting the Promise will be a noop. We need better error handling here.
    const onError = error => {
      if (error.errno === 'EADDRINUSE') {
        // eslint-disable-next-line
        console.error(`ERROR: Port ${options.port} is already in use.`);
        process.exit(1);
      }
      // Note that `error` could be an EADDRINUSE error.
      webServer.removeAllListeners();
      reject(error);
    };
    // TODO(mbolin): If we want the new WebSocketServer to get the 'connection' event,
    // then we need to get it wired up before the webServer is connected.
    webServer.on('listening', () => {
      const webSocketServer = new WS.Server({
        server: webServer,
        perMessageDeflate: true,
      });
      webSocketServer.on('error', onError);

      const launcher: (
        params: LauncherParameters,
        // $FlowIgnore
      ) => Promise<void> = require(options.absolutePathToServerMain);

      const bigDigServer = new BigDigServer(webServer, webSocketServer);
      launcher({
        server: bigDigServer,
        serverParams: options.serverParams,
      }).then(() => {
        // Now the NuclideServer should have attached its own error handler.
        webServer.removeListener('error', onError);
        resolve(webServer.address().port);
      });
    });
    webServer.on('error', onError);
    webServer.listen(options.port);
  });
}
