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

import type {QueuedTransport} from '../QueuedTransport';
import type {RpcConnection} from '../../../nuclide-rpc';

import {getVersion} from '../../../nuclide-version';
import NuclideServer from '../NuclideServer';

export function getServerVersion(): Promise<string> {
  return Promise.resolve(getVersion());
}

// Mark this as async so the client can wait for an acknowledgement.
// However, we can't close the connection right away, as otherwise the response never gets sent!
// Add a small delay to allow the return message to go through.
export function closeConnection(shutdownServer: boolean): Promise<void> {
  const client: RpcConnection<QueuedTransport> = (this: any);
  setTimeout(() => {
    NuclideServer.closeConnection(client);
    if (shutdownServer) {
      NuclideServer.shutdown();
    }
  }, 1000);
  return Promise.resolve();
}
