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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {RemoteConnection} from './RemoteConnection';
import type {OnHeartbeatErrorCallback} from '../../nuclide-remote-connection/lib/ConnectionHealthNotifier.js';
import type {HgRepositoryDescription} from '../../nuclide-source-control-helpers';
import passesGK from '../../commons-node/passesGK';
import typeof * as InfoService from '../../nuclide-server/lib/services/InfoService';
import typeof * as FileWatcherService from '../../nuclide-filewatcher-rpc';
import type {WatchResult} from '../../nuclide-filewatcher-rpc';

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import invariant from 'assert';
import {RpcConnection} from '../../nuclide-rpc';
import {Observable} from 'rxjs';
import servicesConfig from '../../nuclide-server/lib/servicesConfig';
import {
  setConnectionConfig,
  clearConnectionConfig,
} from './RemoteConnectionConfigurationManager';
import {ConnectionHealthNotifier} from './ConnectionHealthNotifier';
import {RemoteFile} from './RemoteFile';
import {RemoteDirectory} from './RemoteDirectory';
import {getAtomSideMarshalers} from '../../nuclide-marshalers-atom';

import {Emitter} from 'atom';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {timeoutPromise} from 'nuclide-commons/promise';
import SharedObservableCache from '../../commons-node/SharedObservableCache';

import {NuclideSocket} from '../../nuclide-server/lib/NuclideSocket';
import {getLogger} from 'log4js';
import {getVersion} from '../../nuclide-version';
import lookupPreferIpv6 from './lookup-prefer-ip-v6';

export type ServerConnectionConfiguration = {
  host: string, // host nuclide server is running on.
  port: number, // port to connect to.
  family?: 4 | 6, // ipv4 or ipv6?
  certificateAuthorityCertificate?: Buffer, // certificate of certificate authority.
  clientCertificate?: Buffer, // client certificate for https connection.
  clientKey?: Buffer, // key for https connection.
};

// ServerConnection represents the client side of a connection to a remote machine.
// There can be at most one connection to a given remote machine at a time. Clients should
// get a ServerConnection via ServerConnection.getOrCreate() and should never call the
// constructor directly. Alternately existing connections can be queried with getByHostname().
//
// getService() returns typed RPC services via the service framework.
//
// A ServerConnection keeps a list of RemoteConnections - one for each open directory on the remote
// machine. Once all RemoteConnections have been closed, then the ServerConnection will close.
export class ServerConnection {
  _config: ServerConnectionConfiguration;
  _closed: boolean;
  _healthNotifier: ?ConnectionHealthNotifier;
  _client: ?RpcConnection<NuclideSocket>;
  _connections: Array<RemoteConnection>;
  _fileWatches: SharedObservableCache<string, WatchResult>;
  _directoryWatches: SharedObservableCache<string, WatchResult>;

  static _connections: Map<string, ServerConnection> = new Map();
  static _emitter = new Emitter();

  static async getOrCreate(
    config: ServerConnectionConfiguration,
  ): Promise<ServerConnection> {
    const existingConnection = ServerConnection.getByHostname(config.host);
    if (existingConnection != null) {
      return existingConnection;
    }

    const newConnection = new ServerConnection(config);
    try {
      await newConnection.initialize();
      return newConnection;
    } catch (e) {
      newConnection.close();
      throw e;
    }
  }

  static cancelConnection(hostname: string): void {
    ServerConnection._emitter.emit('did-cancel', hostname);
  }

  // WARNING: This shuts down all Nuclide servers _without_ closing their
  // RemoteConnections first! This is extremely unsafe and
  // should only be used to forcibly kill Nuclide servers before restarting.
  static forceShutdownAllServers(): Promise<void> {
    return ServerConnection.closeAll(true);
  }

  // WARNING: This shuts down all Nuclide servers _without_ closing their
  // RemoteConnections first! This is extremely unsafe and
  // should only be Called during shutdown, reload, or before autoupdate.
  static async closeAll(shutdown: boolean): Promise<void> {
    await Promise.all(
      Array.from(ServerConnection._connections).map(([_, connection]) => {
        return connection._closeServerConnection(shutdown);
      }),
    );
  }

  // Do NOT call this from outside this class. Use ServerConnection.getOrCreate() instead.
  constructor(config: ServerConnectionConfiguration) {
    this._config = config;
    this._closed = false;
    this._healthNotifier = null;
    this._client = null;
    this._connections = [];
    this._fileWatches = new SharedObservableCache(path => {
      const fileWatcherService: FileWatcherService = this.getService(
        'FileWatcherService',
      );
      return fileWatcherService.watchFile(path).refCount();
    });
    this._directoryWatches = new SharedObservableCache(path => {
      const fileWatcherService: FileWatcherService = this.getService(
        'FileWatcherService',
      );
      return fileWatcherService.watchDirectory(path).refCount();
    });
  }

  dispose(): void {
    if (this._healthNotifier != null) {
      this._healthNotifier.dispose();
    }
  }

  static async _createInsecureConnectionForTesting(
    cwd: string,
    port: number,
  ): Promise<?ServerConnection> {
    const config = {
      host: 'localhost',
      port,
      cwd,
    };
    const connection = new ServerConnection(config);
    await connection.initialize();
    return connection;
  }

  _monitorConnectionHeartbeat() {
    invariant(this._healthNotifier == null);
    this._healthNotifier = new ConnectionHealthNotifier(
      this._config.host,
      this.getSocket(),
    );
  }

  setOnHeartbeatError(onHeartbeatError: OnHeartbeatErrorCallback): void {
    invariant(this._healthNotifier != null);
    this._healthNotifier.setOnHeartbeatError(onHeartbeatError);
  }

  getUriOfRemotePath(remotePath: string): string {
    return `nuclide://${this.getRemoteHostname()}${remotePath}`;
  }

  getPathOfUri(uri: string): string {
    return nuclideUri.parse(uri).path;
  }

  createDirectory(
    uri: NuclideUri,
    hgRepositoryDescription: ?HgRepositoryDescription,
    symlink: boolean = false,
  ): RemoteDirectory {
    let {path} = nuclideUri.parse(uri);
    path = nuclideUri.normalize(path);
    return new RemoteDirectory(this, this.getUriOfRemotePath(path), symlink, {
      hgRepositoryDescription,
    });
  }

  createFile(uri: NuclideUri, symlink: boolean = false): RemoteFile {
    let {path} = nuclideUri.parse(uri);
    path = nuclideUri.normalize(path);
    return new RemoteFile(this, this.getUriOfRemotePath(path), symlink);
  }

  createFileAsDirectory(
    uri: NuclideUri,
    hgRepositoryDescription: ?HgRepositoryDescription,
    symlink: boolean = false,
  ): RemoteDirectory {
    let {path} = nuclideUri.parse(uri);
    path = nuclideUri.normalize(path);
    return new RemoteDirectory(this, this.getUriOfRemotePath(path), symlink, {
      ...hgRepositoryDescription,
      ...{isArchive: true},
    });
  }

  getFileWatch(path: string): Observable<WatchResult> {
    return this._fileWatches.get(path);
  }

  getDirectoryWatch(path: string): Observable<WatchResult> {
    return this._directoryWatches.get(path);
  }

  async initialize(): Promise<void> {
    const useAck = await passesGK('nuclide_connection_ack');
    this._startRpc(useAck);
    const client = this.getClient();
    const clientVersion = getVersion();

    function throwVersionMismatch(version) {
      const err = new Error(
        `Version mismatch. Client at ${clientVersion} while server at ${version}.`,
      );
      err.name = 'VersionMismatchError';
      throw err;
    }

    // Test connection first. First time we get here we're checking to reestablish
    // connection using cached credentials. This will fail fast (faster than infoService)
    // when we don't have cached credentials yet.
    const [heartbeatVersion, ip] = await Promise.all([
      client.getTransport().testConnection(),
      lookupPreferIpv6(this._config.host),
    ]);
    if (clientVersion !== heartbeatVersion) {
      throwVersionMismatch(heartbeatVersion);
    }

    // Do another version check over the RPC framework.
    const serverVersion = await this._getInfoService().getServerVersion();
    if (clientVersion !== serverVersion) {
      throwVersionMismatch(serverVersion);
    }

    this._monitorConnectionHeartbeat();

    ServerConnection._connections.set(this.getRemoteHostname(), this);
    setConnectionConfig(this._config, ip.address);
    ServerConnection._emitter.emit('did-add', this);
  }

  close(): void {
    if (this._closed) {
      return;
    }

    // Future getClient calls should fail, if it has a cached ServerConnection instance.
    this._closed = true;

    // The Rpc channel owns the socket.
    if (this._client != null) {
      this._client.dispose();
      this._client = null;
    }

    // Remove from _connections to not be considered in future connection queries.
    if (ServerConnection._connections.delete(this.getRemoteHostname())) {
      ServerConnection._emitter.emit('did-close', this);
    }
  }

  getClient(): RpcConnection<NuclideSocket> {
    invariant(
      !this._closed && this._client != null,
      'Server connection has been closed.',
    );
    return this._client;
  }

  _startRpc(useAck: boolean): void {
    let uri;
    let options = {useAck};

    // Use https if we have key, cert, and ca
    if (this._isSecure()) {
      invariant(this._config.certificateAuthorityCertificate != null);
      invariant(this._config.clientCertificate != null);
      invariant(this._config.clientKey != null);
      options = {
        ...options,
        ca: this._config.certificateAuthorityCertificate,
        cert: this._config.clientCertificate,
        key: this._config.clientKey,
        family: this._config.family,
      };
      uri = `https://${this.getRemoteHostname()}:${this.getPort()}`;
    } else {
      options = {...options, family: this._config.family};
      uri = `http://${this.getRemoteHostname()}:${this.getPort()}`;
    }

    const socket = new NuclideSocket(uri, options);
    const client = RpcConnection.createRemote(
      socket,
      getAtomSideMarshalers(this.getRemoteHostname()),
      servicesConfig,
      // Track calls with a sampling rate of 1/10.
      {trackSampleRate: 10},
    );

    this._client = client;
  }

  _isSecure(): boolean {
    return Boolean(
      this._config.certificateAuthorityCertificate &&
        this._config.clientCertificate &&
        this._config.clientKey,
    );
  }

  getPort(): number {
    return this._config.port;
  }

  getRemoteHostname(): string {
    return this._config.host;
  }

  getConfig(): ServerConnectionConfiguration {
    return this._config;
  }

  addConnection(connection: RemoteConnection): void {
    this._connections.push(connection);
  }

  async removeConnection(
    connection: RemoteConnection,
    shutdownIfLast: boolean,
  ): Promise<void> {
    invariant(
      this._connections.indexOf(connection) !== -1,
      'Attempt to remove a non-existent RemoteConnection',
    );
    this._connections.splice(this._connections.indexOf(connection), 1);
    if (this._connections.length === 0) {
      // The await here is subtle, it ensures that the shutdown call is sent
      // on the socket before the socket is closed on the next line.
      await this._closeServerConnection(shutdownIfLast);
      this.close();
    }
  }

  static onDidAddServerConnection(
    handler: (connection: ServerConnection) => mixed,
  ): IDisposable {
    return ServerConnection._emitter.on('did-add', handler);
  }

  // exposes an Observable of all the ServerConnection additions,
  // including those that have already connected
  static connectionAdded(): Observable<ServerConnection> {
    return Observable.concat(
      Observable.from(ServerConnection._connections.values()),
      observableFromSubscribeFunction(
        ServerConnection.onDidAddServerConnection,
      ),
    );
  }

  static onDidCancelServerConnection(
    handler: (hostname: string) => mixed,
  ): IDisposable {
    return ServerConnection._emitter.on('did-cancel', handler);
  }

  static connectionAddedToHost(hostname: string): Observable<ServerConnection> {
    const addEvents = ServerConnection.connectionAdded().filter(
      sc => sc.getRemoteHostname() === hostname,
    );
    const cancelEvents = observableFromSubscribeFunction(
      ServerConnection.onDidCancelServerConnection,
    ).filter(cancelledHostname => cancelledHostname === hostname);
    return Observable.merge(
      addEvents,
      cancelEvents.map(x => {
        throw new Error('Cancelled server connection to ' + hostname);
      }),
    );
  }

  static onDidCloseServerConnection(
    handler: (connection: ServerConnection) => mixed,
  ): IDisposable {
    return ServerConnection._emitter.on('did-close', handler);
  }

  static getForUri(uri: NuclideUri): ?ServerConnection {
    const {hostname} = nuclideUri.parse(uri);
    if (hostname == null) {
      return null;
    }
    return ServerConnection.getByHostname(hostname);
  }

  static getByHostname(hostname: string): ?ServerConnection {
    return ServerConnection._connections.get(hostname);
  }

  static observeConnections(
    handler: (connection: ServerConnection) => mixed,
  ): IDisposable {
    ServerConnection._connections.forEach(handler);
    return ServerConnection.onDidAddServerConnection(handler);
  }

  static toDebugString(connection: ?ServerConnection): string {
    return connection == null ? 'local' : connection.getRemoteHostname();
  }

  getRemoteConnectionForUri(uri: NuclideUri): ?RemoteConnection {
    const {path} = nuclideUri.parse(uri);
    return this.getConnections().filter(connection => {
      return path.startsWith(connection.getPathForInitialWorkingDirectory());
    })[0];
  }

  getConnections(): Array<RemoteConnection> {
    return this._connections;
  }

  getService(serviceName: string): any {
    return this.getClient().getService(serviceName);
  }

  getSocket(): NuclideSocket {
    return this.getClient().getTransport();
  }

  _getInfoService(): InfoService {
    return this.getService('InfoService');
  }

  async _closeServerConnection(shutdown: boolean): Promise<void> {
    try {
      // If the Nuclide server has already been shutdown or has crashed,
      // the closeConnection() call will attempt to disconnect from the Nuclide
      // server forever. This sets a 5 second timeout for it so that the rest
      // of this function and anything calling it can complete.
      await timeoutPromise(
        this._getInfoService().closeConnection(shutdown),
        5000,
      );
    } catch (e) {
      getLogger('nuclide-remote-connection').error(
        'Failed to close Nuclide server connection.',
      );
    } finally {
      if (shutdown) {
        // Clear the saved connection config so we don't try it again at startup.
        clearConnectionConfig(this._config.host);
      }
    }
  }

  static observeRemoteConnections(): Observable<Array<ServerConnection>> {
    const emitter = ServerConnection._emitter;
    return Observable.merge(
      observableFromSubscribeFunction(cb => emitter.on('did-add', cb)),
      observableFromSubscribeFunction(cb => emitter.on('did-close', cb)),
      Observable.of(null), // so subscribers get a full list immediately
    ).map(() => Array.from(ServerConnection._connections.values()));
  }
}

export const __test__ = {
  connections: ServerConnection._connections,
};
