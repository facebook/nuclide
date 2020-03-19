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

import type {
  AtomCommands,
  ConnectionDetails,
  MultiConnectionAtomCommands,
} from './rpc-types';
import type {FileCache} from '../../nuclide-open-files-rpc/lib/FileCache';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {CommandServerConnection} from './CommandServerConnection';
import {RoutingAtomCommands} from './RoutingAtomCommands';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import invariant from 'assert';
import {
  loadServicesConfig,
  ServiceRegistry,
  SocketServer,
} from '../../nuclide-rpc';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getValidPathToSocket, RPC_PROTOCOL} from '../shared/ConfigDirectory';
import {localNuclideUriMarshalers} from '../../nuclide-marshalers-common';
import {firstOfIterable, concatIterators} from 'nuclide-commons/collection';

/**
 * A singleton instance of this class should exist in a Nuclide server.
 *
 * A client that connects to the Nuclide server can register a proxy to
 * its implementation of CommandServerConnection via the CommandServer.
 * The Nuclide server can then use the AtomCommands of a
 * CommandServerConnection to make calls into a client.
 *
 * When the Nuclide server needs to take action on a specific client,
 * it can check the hasOpenPath() for each CommandServerConnection until
 * it finds the appropriate connection, if any.
 */
export class CommandServer {
  // The list of connected AtomCommands, most recent connection last.
  // We have no way of detecting a traumatic termination of an Atom
  // process, so the most recent connection is likely the healthiest
  // connection.
  _connections: Array<CommandServerConnection> = [];
  _serverPromise: ?Promise<SocketServer> = null;
  _multiConnectionAtomCommands: MultiConnectionAtomCommands;

  /**
   * In general, this constructor should not be invoked directly.
   * Prefer getCommandServer() in ./command-server-singleton.js.
   */
  constructor() {
    this._multiConnectionAtomCommands = new RoutingAtomCommands(this);
  }

  getConnectionCount(): number {
    return this._connections.length;
  }

  getConnections(): Iterable<CommandServerConnection> {
    return this._connections;
  }

  async _ensureServer(): Promise<SocketServer> {
    if (this._serverPromise == null) {
      this._serverPromise = this._createServer();
    }
    const server = await this._serverPromise;
    await server.untilListening();
    return server;
  }

  async _createServer(): Promise<SocketServer> {
    const services = loadServicesConfig(nuclideUri.join(__dirname, '..'));
    const registry = new ServiceRegistry(
      [localNuclideUriMarshalers],
      services,
      RPC_PROTOCOL,
    );
    const socketPath = await getValidPathToSocket();
    return new SocketServer(registry, socketPath);
  }

  async getConnectionDetails(): Promise<?ConnectionDetails> {
    const server = this.getCurrentServer();
    return server == null ? null : (await this._ensureServer()).getAddress();
  }

  async register(
    fileCache: FileCache,
    atomCommands: AtomCommands,
  ): Promise<IDisposable> {
    await this._ensureServer();
    const connection = new CommandServerConnection(fileCache, atomCommands);
    this._connections.push(connection);
    return new UniversalDisposable(() => this._removeConnection(connection));
  }

  _removeConnection(connection: CommandServerConnection) {
    invariant(this._connections.includes(connection));
    this._connections.splice(this._connections.indexOf(connection), 1);
  }

  getCurrentServer(): ?CommandServerConnection {
    if (this._connections.length === 0) {
      return null;
    }
    return this._connections[this._connections.length - 1];
  }

  getDefaultAtomCommands(): ?AtomCommands {
    const server = this.getCurrentServer();
    return server == null ? null : server.getAtomCommands();
  }

  _getConnectionByPath(filePath: NuclideUri): ?CommandServerConnection {
    return firstOfIterable(
      concatIterators(
        this._connections.filter(connection =>
          connection.hasOpenPath(filePath),
        ),
        [this.getCurrentServer()].filter(server => server != null),
      ),
    );
  }

  getAtomCommandsByPath(filePath: NuclideUri): ?AtomCommands {
    const server = this._getConnectionByPath(filePath);
    return server == null ? null : server.getAtomCommands();
  }

  getMultiConnectionAtomCommands(): MultiConnectionAtomCommands {
    return this._multiConnectionAtomCommands;
  }
}
