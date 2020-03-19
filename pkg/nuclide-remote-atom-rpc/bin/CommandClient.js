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

import typeof * as CommandService from '../lib/CommandService';
import type {MultiConnectionAtomCommands} from '../lib/rpc-types';

import {getServerSocket, RPC_PROTOCOL} from '../shared/ConfigDirectory';
import net from 'net';
import {
  loadServicesConfig,
  RpcConnection,
  SocketTransport,
} from '../../nuclide-rpc';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {localNuclideUriMarshalers} from '../../nuclide-marshalers-common';
import {FailedConnectionError} from './errors';

export async function getCommands(
  argv: {socket: ?string},
  rejectIfZeroConnections: boolean,
): Promise<MultiConnectionAtomCommands> {
  const commands = await (argv.socket != null
    ? startCommands(argv.socket)
    : findExistingCommands());

  if ((await commands.getConnectionCount()) === 0 && rejectIfZeroConnections) {
    throw new FailedConnectionError(
      'Nuclide server is running but no Atom process with Nuclide is connected.',
    );
  }

  return commands;
}

async function findExistingCommands(): Promise<MultiConnectionAtomCommands> {
  // Get the RPC connection info for the filesystem.
  const socketPath = await getServerSocket();
  if (socketPath == null) {
    throw new FailedConnectionError(
      'Could not find a nuclide-server with a connected Atom',
    );
  }
  return startCommands(socketPath);
}

async function startCommands(
  socketPath: string,
): Promise<MultiConnectionAtomCommands> {
  // Setup the RPC connection to the NuclideServer process.
  const services = loadServicesConfig(nuclideUri.join(__dirname, '..'));
  const socket = net.connect({path: socketPath});
  const transport = new SocketTransport(socket);
  try {
    await transport.onConnected();
  } catch (e) {
    // This is usually ECONNREFUSED ...
    // ... indicating that there was a nuclide-server but it is now shutdown.
    throw new FailedConnectionError(
      'Could not find a nuclide-server with a connected Atom ' +
        '("Nuclide/Kill Nuclide Server and Restart" will likely help)',
    );
  }
  const connection = RpcConnection.createLocal(
    transport,
    [localNuclideUriMarshalers],
    services,
    RPC_PROTOCOL,
  );

  // Get the command interface
  const service: CommandService = connection.getService('CommandService');
  return service.getAtomCommands();
}
