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

import type {AtomCommands, AtomFileEvent, ConnectionDetails} from './rpc-types';
import type {FileCache} from '../../nuclide-open-files-rpc/lib/FileCache';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ConnectableObservable} from 'rxjs';

import invariant from 'assert';
import {
  loadServicesConfig,
  ServiceRegistry,
  SocketServer,
} from '../../nuclide-rpc';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {createNewEntry, RPC_PROTOCOL} from '../shared/ConfigDirectory';
import {localNuclideUriMarshalers} from '../../nuclide-marshalers-common';
import {
  iterableIsEmpty,
  filterIterable,
  iterableContains,
  firstOfIterable,
  concatIterators,
} from 'nuclide-commons/collection';
import {Observable} from 'rxjs';

// Ties the AtomCommands registered via RemoteCommandService to
// the server side CommandService.
export class CommandServer {
  // The list of connected AtomCommands, most recent connection last.
  // We have no way of detecting a traumatic termination of an Atom
  // process, so the most recent connection is likely the healthiest
  // connection.
  static _connections: Array<CommandServer> = [];
  static _server: ?SocketServer = null;

  static async _ensureServer(): Promise<SocketServer> {
    if (CommandServer._server != null) {
      return CommandServer._server;
    }
    const services = loadServicesConfig(nuclideUri.join(__dirname, '..'));
    const registry = new ServiceRegistry(
      [localNuclideUriMarshalers],
      services,
      RPC_PROTOCOL,
    );
    const result = new SocketServer(registry);
    CommandServer._server = result;
    const address = await result.getAddress();
    await createNewEntry(address.port, address.family);
    return result;
  }

  static async getConnectionDetails(): Promise<?ConnectionDetails> {
    const server = CommandServer.getCurrentServer();
    return server == null
      ? null
      : (await CommandServer._ensureServer()).getAddress();
  }

  _atomCommands: AtomCommands;
  _fileCache: FileCache;

  constructor(fileCache: FileCache, atomCommands: AtomCommands) {
    this._atomCommands = atomCommands;
    this._fileCache = fileCache;

    CommandServer._ensureServer();
  }

  hasOpenPath(filePath: NuclideUri): boolean {
    return (
      !iterableIsEmpty(
        filterIterable(this._fileCache.getOpenDirectories(), dir =>
          nuclideUri.contains(dir, filePath),
        ),
      ) || iterableContains(this._fileCache.getOpenFiles(), filePath)
    );
  }

  dispose(): void {
    invariant(CommandServer._connections.includes(this));
    CommandServer._connections.splice(
      CommandServer._connections.indexOf(this),
      1,
    );
  }

  static async register(
    fileCache: FileCache,
    atomCommands: AtomCommands,
  ): Promise<IDisposable> {
    const server = new CommandServer(fileCache, atomCommands);
    CommandServer._connections.push(server);
    return server;
  }

  static getCurrentServer(): ?CommandServer {
    if (CommandServer._connections.length === 0) {
      return null;
    }
    return CommandServer._connections[CommandServer._connections.length - 1];
  }

  static getDefaultAtomCommands(): ?AtomCommands {
    const server = CommandServer.getCurrentServer();
    return server == null ? null : server._atomCommands;
  }

  static getServerByPath(filePath: NuclideUri): ?CommandServer {
    return firstOfIterable(
      concatIterators(
        CommandServer._connections.filter(server =>
          server.hasOpenPath(filePath),
        ),
        [CommandServer.getCurrentServer()].filter(server => server != null),
      ),
    );
  }

  static getAtomCommandsByPath(filePath: NuclideUri): ?AtomCommands {
    const server = CommandServer.getServerByPath(filePath);
    return server == null ? null : server._atomCommands;
  }

  static getAtomCommands(): ?AtomCommands {
    return CommandServer._connections.length === 0
      ? null
      : new ServiceAtomCommands();
  }
}

class ServiceAtomCommands {
  openFile(
    filePath: NuclideUri,
    line: number,
    column: number,
    isWaiting: boolean,
  ): ConnectableObservable<AtomFileEvent> {
    const commands = CommandServer.getAtomCommandsByPath(filePath);
    if (commands != null) {
      return commands.openFile(filePath, line, column, isWaiting);
    } else {
      return Observable.throw('No connected Atom windows').publish();
    }
  }

  openRemoteFile(
    uri: string,
    line: number,
    column: number,
    isWaiting: boolean,
  ): ConnectableObservable<AtomFileEvent> {
    const commands = CommandServer.getAtomCommandsByPath(uri);
    if (commands != null) {
      return commands.openRemoteFile(uri, line, column, isWaiting);
    } else {
      return Observable.throw('No connected Atom windows').publish();
    }
  }

  addProject(projectPath: NuclideUri): Promise<void> {
    const commands = CommandServer.getAtomCommandsByPath(projectPath);
    if (commands != null) {
      return commands.addProject(projectPath);
    } else {
      throw new Error('No connected Atom windows');
    }
  }

  dispose(): void {}
}
