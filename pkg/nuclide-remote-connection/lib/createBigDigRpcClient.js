/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {BigDigClient} from 'big-dig/src/client';
import type {ServerConnectionConfiguration} from './ServerConnection';
import type {Transport} from '../../nuclide-rpc';

import {createBigDigClient} from 'big-dig/src/client';
import {getClientSideMarshalers} from '../../nuclide-marshalers-client';
import {RpcConnection} from '../../nuclide-rpc';
import {SERVICE_FRAMEWORK3_PROTOCOL} from '../../nuclide-rpc/lib/config';
import servicesConfig from '../../nuclide-server/lib/servicesConfig';
import {protocolLogger} from '../../nuclide-server/lib/utils';
import {NUCLIDE_RPC_TAG} from '../../nuclide-server2/lib/constants';

export default (async function createBigDigRpcClient(
  config: ServerConnectionConfiguration,
): Promise<{
  bigDigClient: BigDigClient,
  rpcConnection: RpcConnection<Transport>,
}> {
  const bigDigClient = await createBigDigClient({
    ...config,
    ignoreIntransientErrors: true,
    protocolLogger,
  });
  const bigDigTransport: Transport = {
    send(message: string) {
      bigDigClient.sendMessage(NUCLIDE_RPC_TAG, message);
    },
    onMessage() {
      return bigDigClient.onMessage(NUCLIDE_RPC_TAG);
    },
    close() {
      bigDigClient.close();
    },
    isClosed() {
      return bigDigClient.isClosed();
    },
  };
  return {
    bigDigClient,
    rpcConnection: RpcConnection.createRemote(
      bigDigTransport,
      getClientSideMarshalers(config.host),
      servicesConfig,
      {trackSampleRate: 10},
      SERVICE_FRAMEWORK3_PROTOCOL,
      null,
      protocolLogger,
    ),
  };
});
