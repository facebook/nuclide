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

import type {QueuedAckTransport} from 'big-dig/src/socket/QueuedAckTransport';
import type {RpcConnection} from '../../../nuclide-rpc';

import {
  getEnvironment,
  getOriginalEnvironmentArray,
} from 'nuclide-commons/process';
import {getVersion} from '../../../nuclide-version';
import NuclideServer from '../NuclideServer';

export function getServerVersion(): Promise<string> {
  return Promise.resolve(getVersion());
}

export async function getServerPlatform(): Promise<string> {
  return process.platform;
}

export async function getOriginalEnvironment(): Promise<Array<string>> {
  return getOriginalEnvironmentArray();
}

export async function getServerEnvironment(): Promise<Object> {
  return getEnvironment();
}

// Mark this as async so the client can wait for an acknowledgement.
// However, we can't close the connection right away, as otherwise the response never gets sent!
// Add a small delay to allow the return message to go through.
export function closeConnection(shutdownServer: boolean): Promise<void> {
  const client: RpcConnection<QueuedAckTransport> = (this: any);
  setTimeout(() => {
    // TODO(T29368542): Remove references to NuclideServer here.
    NuclideServer.closeConnection(client);
    client.dispose();
    if (shutdownServer) {
      NuclideServer.shutdown();
    }
  }, 1000);
  return Promise.resolve();
}
