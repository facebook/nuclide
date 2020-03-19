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

import type {ProtocolLogger} from '../socket/QueuedAckTransport';

import {HEARTBEAT_CHANNEL} from '../server/BigDigServer';
import {BigDigClient} from './BigDigClient';
import {ReliableSocket} from '../socket/ReliableSocket';

export type BigDigClientConfig = {
  +host: string,
  +port: number,
  +family?: 4 | 6,
  +certificateAuthorityCertificate?: Buffer | string | Array<string>,
  +clientCertificate?: Buffer | string,
  +clientKey?: Buffer | string,
  +ignoreIntransientErrors: boolean,
  +protocolLogger?: ProtocolLogger,
};

/**
 * Creates a Big Dig client that speaks the v1 protocol.
 */
export default (async function createBigDigClient(
  config: BigDigClientConfig,
): Promise<BigDigClient> {
  const reliableSocket = createReliableSocket(config);
  const client = new BigDigClient(reliableSocket);
  try {
    // Make sure we're able to make the initial connection
    await reliableSocket.testConnection();
    return client;
  } catch (error) {
    client.close();
    throw error;
  }
});

function createReliableSocket(config: BigDigClientConfig): ReliableSocket {
  const options = {
    ca: config.certificateAuthorityCertificate,
    cert: config.clientCertificate,
    key: config.clientKey,
    family: config.family,
  };

  const serverUri = `https://${config.host}:${config.port}/v1`;

  const reliableSocket = new ReliableSocket(
    serverUri,
    HEARTBEAT_CHANNEL,
    options,
    config.protocolLogger,
  );

  if (!config.ignoreIntransientErrors) {
    reliableSocket.onIntransientError(error => reliableSocket.close());
  }

  return reliableSocket;
}
