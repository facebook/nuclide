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

import type {XhrConnectionHeartbeat} from 'big-dig/src/client/XhrConnectionHeartbeat';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {BigDigClient} from 'big-dig/src/client';
import type {Transport} from '../../nuclide-rpc';
import type {RemoteConnection} from './RemoteConnection';
import type {OnHeartbeatErrorCallback} from '../../nuclide-remote-connection/lib/ConnectionHealthNotifier.js';
import type {HgRepositoryDescription} from '../../nuclide-source-control-helpers/lib/types';
import {SERVICE_FRAMEWORK3_PROTOCOL} from '../../nuclide-rpc/lib/config';
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
  SERVER_CONFIG_REQUEST_EVENT,
  SERVER_CONFIG_RESPONSE_EVENT,
} from './RemoteConnectionConfigurationManager';
import {ConnectionHealthNotifier} from './ConnectionHealthNotifier';
import {RemoteFile} from './RemoteFile';
import {RemoteDirectory} from './RemoteDirectory';
import {getClientSideMarshalers} from '../../nuclide-marshalers-client';
import {trackTimingSampled} from 'nuclide-analytics';

import {Emitter} from 'event-kit';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {timeoutPromise} from 'nuclide-commons/promise';
import SharedObservableCache from '../../commons-node/SharedObservableCache';

import {ReliableSocket} from 'big-dig/src/socket/ReliableSocket';
import {HEARTBEAT_CHANNEL} from '../../nuclide-server/lib/NuclideServer';
import {protocolLogger} from '../../nuclide-server/lib/utils';
import {getLogger} from 'log4js';
import {getVersion} from '../../nuclide-version';
import lookupPreferIpv6 from './lookup-prefer-ip-v6';
import createBigDigRpcClient from './createBigDigRpcClient';
import {isGkEnabled} from 'nuclide-commons/passesGK';
import {onceGkInitializedAsync} from 'nuclide-commons/passesGK';
import {
  getOrCreateRfsClientAdapter,
  SUPPORTED_THRIFT_RFS_FUNCTIONS,
} from './thrift-service-adapters/ThriftRfsClientAdapter';

import electron from 'electron';

const logger = getLogger('nuclide-remote-connection');
const thriftRfsLogger = getLogger('thrift-rfs-server-connection');
const remote = electron.remote;
const ipc = electron.ipcRenderer;
const THRIFT_RFS_GK = 'nuclide_thrift_rfs';
const FILE_SYSTEM_PERFORMANCE_SAMPLE_RATE = 10;

invariant(remote);
invariant(ipc);

export type ServerConnectionVersion = 1 | 2;
export const BIG_DIG_VERSION: ServerConnectionVersion = 2;

export type ServerConnectionConfiguration = {
  host: string, // host nuclide server is running on.
  port: number, // port to connect to.
  family?: 4 | 6, // ipv4 or ipv6?
  certificateAuthorityCertificate?: Buffer | Array<string>, // certificate of ca.
  clientCertificate?: Buffer, // client certificate for https connection.
  clientKey?: Buffer, // key for https connection.
  version?: ServerConnectionVersion,
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
  _heartbeat: ?XhrConnectionHeartbeat;
  _client: ?RpcConnection<Transport>;
  _connections: Array<RemoteConnection>;
  _fileWatches: SharedObservableCache<string, WatchResult>;
  _directoryWatches: SharedObservableCache<string, WatchResult>;
  _bigDigClient: ?BigDigClient;

  static _hostToConnection: Map<string, ServerConnection> = new Map();
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
      await onceGkInitializedAsync(); // wait for GKs to be initialized
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
      Array.from(ServerConnection._hostToConnection).map(([_, connection]) => {
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
    this._bigDigClient = null;
    this._heartbeat = null;
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

    ipc.on(SERVER_CONFIG_REQUEST_EVENT, (event, host, id) => {
      logger.info(
        `received request for server config for ${host} from window ${id}`,
      );
      let response = null;
      if (host === this._config.host) {
        logger.info(`found the server config for ${host}, sending it via ipc`);
        response = this._config;
      }

      const theWindow = remote.BrowserWindow.getAllWindows().filter(
        win => win.id === id,
      )[0];
      invariant(theWindow);
      theWindow.webContents.send(SERVER_CONFIG_RESPONSE_EVENT, response);
    });
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
      this._config.port,
      this.getHeartbeat(),
    );
  }

  setOnHeartbeatError(onHeartbeatError: OnHeartbeatErrorCallback): void {
    invariant(this._healthNotifier != null);
    this._healthNotifier.setOnHeartbeatError(onHeartbeatError);
  }

  getUriOfRemotePath(remotePath: string): string {
    return `nuclide://${this.getRemoteHostname()}${remotePath}`;
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
    await this._startRpc();
    const clientVersion = getVersion();

    function throwVersionMismatch(version) {
      const err = new Error(
        `Version mismatch. Client at ${clientVersion} while server at ${version}.`,
      );
      err.name = 'VersionMismatchError';
      throw err;
    }

    // NOTE: BigDig's version may not actually match Nuclide's
    if (this._config.version !== 2) {
      // Test connection first. First time we get here we're checking to reestablish
      // connection using cached credentials. This will fail fast (faster than infoService)
      // when we don't have cached credentials yet.
      const heartbeatVersion = await this.getHeartbeat().sendHeartBeat();
      if (clientVersion !== heartbeatVersion) {
        throwVersionMismatch(heartbeatVersion);
      }
    }

    // Do another version check over the RPC framework.
    const [serverVersion, ip] = await Promise.all([
      this._getInfoService().getServerVersion(),
      lookupPreferIpv6(this._config.host),
    ]);
    if (clientVersion !== serverVersion) {
      throwVersionMismatch(serverVersion);
    }

    this._monitorConnectionHeartbeat();

    ServerConnection._hostToConnection.set(this.getRemoteHostname(), this);
    await setConnectionConfig(this._config, ip.address);
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
      if (this._heartbeat) {
        this._heartbeat.close();
        this._heartbeat = null;
      }
    }

    // Remove from _connections to not be considered in future connection queries.
    if (ServerConnection._hostToConnection.delete(this.getRemoteHostname())) {
      ServerConnection._emitter.emit('did-close', this);
    }

    if (this._healthNotifier != null) {
      this._healthNotifier.dispose();
    }

    ipc.removeAllListeners(SERVER_CONFIG_REQUEST_EVENT);
  }

  getClient(): RpcConnection<Transport> {
    invariant(
      !this._closed && this._client != null,
      'Server connection has been closed.',
    );
    return this._client;
  }

  getBigDigClient(): BigDigClient {
    invariant(
      !this._closed && this._bigDigClient != null,
      'Server connection has been closed',
    );

    return this._bigDigClient;
  }

  getHeartbeat(): XhrConnectionHeartbeat {
    invariant(
      !this._closed && this._client != null && this._heartbeat != null,
      'Server connection has been closed.',
    );
    return this._heartbeat;
  }

  async _startRpc(): Promise<void> {
    if (this._config.version === BIG_DIG_VERSION) {
      const {bigDigClient, rpcConnection} = await createBigDigRpcClient(
        this._config,
      );
      this._client = rpcConnection;
      this._bigDigClient = bigDigClient;
      this._heartbeat = bigDigClient.getHeartbeat();
      return;
    }

    let uri;
    let options = {};

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

    const socket = new ReliableSocket(
      uri,
      HEARTBEAT_CHANNEL,
      options,
      protocolLogger,
    );
    const client = RpcConnection.createRemote(
      (socket: Transport),
      getClientSideMarshalers(this.getRemoteHostname()),
      servicesConfig,
      // Track calls with a sampling rate of 1/10.
      {trackSampleRate: 10},
      SERVICE_FRAMEWORK3_PROTOCOL,
      socket.id,
      protocolLogger,
    );

    this._client = client;
    this._heartbeat = socket.getHeartbeat();
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
    logger.info('Removed connection.', {
      cwd: connection.getUri(),
      title: connection.getDisplayTitle(),
      remainingConnections: this._connections.length,
    });
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
      Observable.from(ServerConnection._hostToConnection.values()),
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
    ).filter(canceledHostname => canceledHostname === hostname);
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
    if (!nuclideUri.isRemote(uri)) {
      return null;
    }
    return ServerConnection.getByHostname(nuclideUri.getHostname(uri));
  }

  static getByHostname(hostname: string): ?ServerConnection {
    return ServerConnection._hostToConnection.get(hostname);
  }

  static observeConnections(
    handler: (connection: ServerConnection) => mixed,
  ): IDisposable {
    ServerConnection._hostToConnection.forEach(handler);
    return ServerConnection.onDidAddServerConnection(handler);
  }

  static toDebugString(connection: ?ServerConnection): string {
    return connection == null ? 'local' : connection.getRemoteHostname();
  }

  getRemoteConnectionForUri(uri: NuclideUri): ?RemoteConnection {
    const {path} = nuclideUri.parse(uri);
    return this.getConnections().filter(connection => {
      return path.startsWith(connection.getPath());
    })[0];
  }

  getConnections(): Array<RemoteConnection> {
    return this._connections;
  }

  hasSingleMountPoint(): boolean {
    return this.getConnections().length === 1;
  }

  getService(serviceName: string): Object {
    const rpcService = this.getClient().getService(serviceName);
    if (serviceName === 'FileSystemService') {
      if (isGkEnabled(THRIFT_RFS_GK)) {
        return this._getThriftRfsServiceProxy(rpcService);
      }
      return this._getLegacyRfsServiceProxy(rpcService);
    }
    return rpcService;
  }

  _getLegacyRfsServiceProxy(rpcService: any): Object {
    const handler = {
      get: (target, propKey, receiver) => {
        // time function if it has a corresponding thrift call
        // so the two can be compared
        if (SUPPORTED_THRIFT_RFS_FUNCTIONS.has(propKey)) {
          return (...args) => {
            return trackTimingSampled(
              `file-system-service:${propKey}`,
              // eslint-disable-next-line prefer-spread
              () => target[propKey].apply(target, args),
              FILE_SYSTEM_PERFORMANCE_SAMPLE_RATE,
              {serviceProvider: 'rpc'},
            );
          };
        }
        return target[propKey];
      },
    };
    return new Proxy(rpcService, handler);
  }

  _getThriftRfsServiceProxy(rpcService: Object): Object {
    const handler = {
      get: (target: Object, propKey: string, receiver) => {
        if (SUPPORTED_THRIFT_RFS_FUNCTIONS.has(propKey)) {
          return (...args) => {
            return this._makeThriftRfsCall(propKey, args);
          };
        }
        return target[propKey];
      },
    };
    return new Proxy(rpcService, handler);
  }

  async _makeThriftRfsCall(
    fsOperation: string,
    args: Array<any>,
  ): Promise<any> {
    return trackTimingSampled(
      `file-system-service:${fsOperation}`,
      async () => {
        try {
          const thriftRfsClient = await getOrCreateRfsClientAdapter(
            this.getBigDigClient(),
          );
          // $FlowFixMe: suppress 'indexer property is missing warning'
          const method = thriftRfsClient[fsOperation];
          return await method.apply(thriftRfsClient, args);
        } catch (e) {
          thriftRfsLogger.error(
            `failed to run method ${fsOperation} from Thrift client`,
            e,
          );
          throw e;
        }
      },
      FILE_SYSTEM_PERFORMANCE_SAMPLE_RATE,
      {serviceProvider: 'thrift'},
    );
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
    ).map(() => Array.from(ServerConnection._hostToConnection.values()));
  }

  static getAllConnections(): Array<ServerConnection> {
    return Array.from(ServerConnection._hostToConnection.values());
  }
}

export const __test__ = {
  connections: ServerConnection._hostToConnection,
};
