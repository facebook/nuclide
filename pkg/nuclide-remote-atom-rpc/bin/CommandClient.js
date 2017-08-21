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

import typeof * as CommandService from '../lib/CommandService';
import type {AtomCommands} from '../lib/rpc-types';

import {getServer, RPC_PROTOCOL} from '../shared/ConfigDirectory';
import net from 'net';
import {
  loadServicesConfig,
  RpcConnection,
  SocketTransport,
} from '../../nuclide-rpc';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {localNuclideUriMarshalers} from '../../nuclide-marshalers-common';
import {reportConnectionErrorAndExit} from './errors';
import invariant from 'assert';

function convertStringFamilyToNumberFamily(family: string): number {
  switch (family) {
    case 'IPv4':
      return 4;
    case 'IPv6':
      return 6;
    default:
      throw new Error(`Unrecognized network address family ${family}`);
  }
}

export async function getCommands(): Promise<AtomCommands> {
  // Get the RPC connection info for the filesystem.
  const serverInfo = await getServer();
  if (serverInfo == null) {
    reportConnectionErrorAndExit(
      'Could not find a nuclide-server with a connected Atom',
    );
  }
  invariant(serverInfo != null);
  const {commandPort, family} = serverInfo;
  return startCommands(commandPort, family);
}

export async function startCommands(
  commandPort: number,
  family: string,
): Promise<AtomCommands> {
  // Setup the RPC connection to the NuclideServer process.
  const services = loadServicesConfig(nuclideUri.join(__dirname, '..'));
  const socket = net.connect({
    port: commandPort,
    family: convertStringFamilyToNumberFamily(family),
  });
  const transport = new SocketTransport(socket);
  try {
    await transport.onConnected();
  } catch (e) {
    // This is usually ECONNREFUSED ...
    // ... indicating that there was a nuclide-server but it is now shutdown.
    reportConnectionErrorAndExit(
      'Could not find a nuclide-server with a connected Atom ("Nuclide/Kill Nuclide Server and Restart" will likely help)',
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
  const commands = await service.getAtomCommands();
  if (commands == null) {
    reportConnectionErrorAndExit(
      'Nuclide server is running but no Atom process with Nuclide is connected.',
    );
  }
  invariant(commands != null);
  return commands;
}
