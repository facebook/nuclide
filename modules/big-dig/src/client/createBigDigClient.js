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

import WS from 'ws';
import https from 'https';

import type {RemoteConnectionConfiguration} from './SshHandshake';
import {WebSocketTransport} from './WebSocketTransport';
import {BigDigClient} from './BigDigClient';

/**
 * Creates a Big Dig client that speaks the v1 protocol.
 */
export default (async function createBigDigClient(
  config: RemoteConnectionConfiguration,
): Promise<BigDigClient> {
  const options = {
    ca: config.certificateAuthorityCertificate,
    cert: config.clientCertificate,
    key: config.clientKey,
  };
  const socket = new WS(`wss://${config.host}:${config.port}/v1`, options);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  const agent = new https.Agent(options);
  const webSocketTransport = new WebSocketTransport('test', agent, socket);
  return new BigDigClient(webSocketTransport);
});
