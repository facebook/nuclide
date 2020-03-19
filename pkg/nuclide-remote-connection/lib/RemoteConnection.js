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
import type {HgRepositoryDescription} from '../../nuclide-source-control-helpers/lib/types';
// $FlowFB
import type ProjectManager from '../../fb-atomprojects/lib/ProjectManager';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {Observable} from 'rxjs';
import typeof * as FileWatcherServiceType from '../../nuclide-filewatcher-rpc';
import typeof * as FileSystemServiceType from '../../nuclide-server/lib/services/FileSystemService';
import typeof * as SourceControlService from '../../nuclide-server/lib/services/SourceControlService';
import type {RemoteDirectory} from './RemoteDirectory';
import type {ServerConnectionVersion} from './ServerConnection';

import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import lookupPreferIpv6 from './lookup-prefer-ip-v6';
import {ServerConnection} from './ServerConnection';
import {Emitter} from 'event-kit';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getConnectionConfig} from './RemoteConnectionConfigurationManager';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-remote-connection');

const FILE_WATCHER_SERVICE = 'FileWatcherService';
const FILE_SYSTEM_SERVICE = 'FileSystemService';

export type RemoteConnectionConfiguration = {
  host: string, // host nuclide server is running on.
  port: number, // port to connect to.
  family?: 4 | 6, // ipv4 or ipv6?
  certificateAuthorityCertificate?: Buffer | Array<string>, // certificate of ca.
  clientCertificate?: Buffer, // client certificate for https connection.
  clientKey?: Buffer, // key for https connection.
  version?: ServerConnectionVersion,

  // Stuff specific to RemoteConnectionConfiguration (e.g. not in ServerConnectionConfiguration)
  path: string, // Path to remote directory user should start in upon connection.
  displayTitle: string, // Name of the saved connection profile.
  promptReconnectOnFailure?: boolean, // open a connection dialog prompt if the reconnect fails
};

// A RemoteConnection represents a directory which has been opened in Nuclide on a remote machine.
// This corresponds to what atom calls a 'root path' in a project.
//
// TODO: The _entries and _hgRepositoryDescription should not be here.
// Nuclide behaves badly when remote directories are opened which are parent/child of each other.
// And there needn't be a 1:1 relationship between RemoteConnections and hg repos.
export class RemoteConnection {
  _path: string; // Path to remote directory user should start in upon connection.
  _subscriptions: UniversalDisposable;
  _hgRepositoryDescription: ?HgRepositoryDescription;
  _connection: ServerConnection;
  _displayTitle: string;
  _alwaysShutdownIfLast: boolean;
  _promptReconnectOnFailure: boolean;

  static _emitter = new Emitter();

  static async findOrCreate(
    config: RemoteConnectionConfiguration,
  ): Promise<RemoteConnection> {
    const serverConnection = await ServerConnection.getOrCreate(config);
    const {path, displayTitle, promptReconnectOnFailure} = config;
    let roots;

    try {
      const fsService: FileSystemServiceType = serverConnection.getService(
        FILE_SYSTEM_SERVICE,
      );

      if (hasAtomProjectFormat(path)) {
        // IMPORTANT: We have to be careful not to assume the existence of the project file in this
        // code path (e.g. by using `realpath()`) so that the project manager can provide a fallback
        // for nonexistent files.
        const projectManager = await getProjectManager();
        if (projectManager == null) {
          throw new Error(
            "You tried to load a project but the nuclide.project-manager service wasn't available.",
          );
        }
        const expandedPath = await fsService.expandHomeDir(path);
        await projectManager.load(
          serverConnection.getUriOfRemotePath(expandedPath),
        );
        // $FlowFixMe: Upstream this and add to our type defs
        roots = atom.project.getSpecification().paths.map(nuclideUri.getPath);
      } else {
        const realPath = await fsService.resolveRealPath(path);
        // Now that we know the real path, it's possible this collides with an existing connection.
        if (realPath !== path && nuclideUri.isRemote(path)) {
          const existingConnection = this.getByHostnameAndPath(
            nuclideUri.getHostname(path),
            realPath,
          );
          if (existingConnection != null) {
            return existingConnection;
          }
        }
        roots = [realPath];
      }
    } catch (err) {
      // Don't leave server connections hanging:
      // if we created a server connection from getOrCreate but failed above
      // then we need to make sure the connection gets closed.
      if (serverConnection.getConnections().length === 0) {
        serverConnection.close();
      }
      throw err;
    }
    const connections = await Promise.all(
      roots.map((dir, i) => {
        const connection = new RemoteConnection(
          serverConnection,
          dir,
          i === 0 ? displayTitle : '',
          promptReconnectOnFailure !== false, // default: true
        );
        return connection._initialize();
      }),
    );
    // We need to return one connection from this function,
    // even though many connections are being created to support projects.
    return connections[0];
  }

  // Do NOT call this directly. Use findOrCreate instead.
  constructor(
    connection: ServerConnection,
    path: string,
    displayTitle: string,
    promptReconnectOnFailure: boolean,
  ) {
    this._path = path;
    this._subscriptions = new UniversalDisposable();
    this._hgRepositoryDescription = null;
    this._connection = connection;
    this._displayTitle = displayTitle;
    this._alwaysShutdownIfLast = false;
    this._promptReconnectOnFailure = promptReconnectOnFailure;
  }

  static _createInsecureConnectionForTesting(
    path: string,
    port: number,
  ): Promise<RemoteConnection> {
    const config = {
      host: 'localhost',
      port,
      path,
      displayTitle: '',
    };
    return RemoteConnection.findOrCreate(config);
  }

  /**
   * Create a connection by reusing the configuration of last successful connection associated with
   * given host. If the server's certs has been updated or there is no previous successful
   * connection, null (resolved by promise) is returned.
   * Configurations may also be retrieved by IP address.
   */
  static async _createConnectionBySavedConfig(
    host: string,
    path: string,
    displayTitle: string,
    promptReconnectOnFailure: boolean = true,
  ): Promise<?RemoteConnection> {
    const connectionConfig = await getConnectionConfig(host);
    if (!connectionConfig) {
      return null;
    }
    try {
      const config = {
        ...connectionConfig,
        path,
        displayTitle,
        promptReconnectOnFailure,
      };
      return await RemoteConnection.findOrCreate(config);
    } catch (e) {
      // Returning null from this method signals that we should
      // should restart the handshake process with same config.
      // But there are some errors for which we don't want to do that
      // (like if the connection fails because the directory doesn't exist).
      if (e.code === 'ENOENT' || e.name === 'ProjectLoadError') {
        e.sshHandshakeErrorType = 'DIRECTORY_NOT_FOUND';
        throw e;
      }

      const log =
        e.name === 'VersionMismatchError'
          ? logger.warn.bind(logger)
          : logger.error.bind(logger);

      log(`Failed to reuse connectionConfiguration for ${host}`, e);
      return null;
    }
  }

  /**
   * Attempts to connect to an open or previously open remote connection.
   */
  static async reconnect(
    host: string,
    path: string,
    displayTitle: string,
    promptReconnectOnFailure: boolean = true,
  ): Promise<?RemoteConnection> {
    logger.info('Attempting to reconnect', {
      host,
      path,
      displayTitle,
      promptReconnectOnFailure,
    });

    if (!hasAtomProjectFormat(path)) {
      const connection = RemoteConnection.getByHostnameAndPath(host, path);

      if (connection != null) {
        return connection;
      }
    }

    let connection = await RemoteConnection._createConnectionBySavedConfig(
      host,
      path,
      displayTitle,
      promptReconnectOnFailure,
    );
    if (connection == null) {
      try {
        // Connection configs are also stored by IP address to share between hostnames.
        const {address} = await lookupPreferIpv6(host);
        connection = await RemoteConnection._createConnectionBySavedConfig(
          address,
          path,
          displayTitle,
          promptReconnectOnFailure,
        );
      } catch (err) {
        // It's OK if the backup IP check fails.
      }
    }
    return connection;
  }

  // A workaround before Atom 2.0: Atom's Project::setPaths currently uses
  // ::repositoryForDirectorySync, so we need the repo information to already be
  // available when the new path is added. t6913624 tracks cleanup of this.
  async _setHgRepoInfo(): Promise<void> {
    const remotePath = this.getPath();
    const {getHgRepository} = (this.getConnection().getService(
      'SourceControlService',
    ): SourceControlService);
    this._setHgRepositoryDescription(await getHgRepository(remotePath));
  }

  createDirectory(uri: string, symlink: boolean = false): RemoteDirectory {
    return this._connection.createDirectory(
      uri,
      this._hgRepositoryDescription,
      symlink,
    );
  }

  // A workaround before Atom 2.0: see ::getHgRepoInfo of main.js.
  _setHgRepositoryDescription(
    hgRepositoryDescription: ?HgRepositoryDescription,
  ): void {
    this._hgRepositoryDescription = hgRepositoryDescription;
  }

  getHgRepositoryDescription(): ?HgRepositoryDescription {
    return this._hgRepositoryDescription;
  }

  async _initialize(): Promise<RemoteConnection> {
    const attemptShutdown = false;
    // Must add first to prevent the ServerConnection from going away
    // in a possible race.
    this._connection.addConnection(this);
    try {
      // A workaround before Atom 2.0: see ::getHgRepoInfo.
      await this._setHgRepoInfo();

      RemoteConnection._emitter.emit('did-add', this);
      this._watchRootProjectDirectory();
    } catch (e) {
      this.close(attemptShutdown);
      throw e;
    }
    return this;
  }

  _watchRootProjectDirectory(): void {
    const rootDirectoryUri = this.getUri();
    const rootDirectoryPath = this.getPath();
    const FileWatcherService: FileWatcherServiceType = this.getConnection().getService(
      FILE_WATCHER_SERVICE,
    );
    invariant(FileWatcherService);
    const {watchDirectoryRecursive} = FileWatcherService;
    // Start watching the project for changes and initialize the root watcher
    // for next calls to `watchFile` and `watchDirectory`.
    const watchStream = watchDirectoryRecursive(rootDirectoryUri).refCount();
    const subscription = watchStream.subscribe(
      watchUpdate => {
        // Nothing needs to be done if the root directory was watched correctly.
        // Let's just console log it anyway.
        logger.info(
          `Watcher Features Initialized for project: ${rootDirectoryUri}`,
          watchUpdate,
        );
      },
      async error => {
        let warningMessageToUser = '';
        let detail;
        const fileSystemService: FileSystemServiceType = this.getConnection().getService(
          FILE_SYSTEM_SERVICE,
        );
        if (await fileSystemService.isNfs(rootDirectoryUri)) {
          warningMessageToUser +=
            `This project directory: \`${rootDirectoryPath}\` is on <b>\`NFS\`</b> filesystem. ` +
            'Nuclide works best with local (non-NFS) root directory.' +
            'e.g. `/data/users/$USER`' +
            'features such as synced remote file editing, file search, ' +
            'and Mercurial-related updates will not work.<br/>';
        } else {
          warningMessageToUser +=
            'You just connected to a remote project ' +
            `\`${rootDirectoryPath}\` without Watchman support, which means that ` +
            'crucial features such as synced remote file editing, file search, ' +
            'and Mercurial-related updates will not work.';
          detail = error.message || error;
          logger.error(
            'Watchman failed to start - watcher features disabled!',
            error,
          );
        }
        // Add a persistent warning message to make sure the user sees it before dismissing.
        atom.notifications.addWarning(warningMessageToUser, {
          dismissable: true,
          detail,
        });
      },
      () => {
        // Nothing needs to be done if the root directory watch has ended.
        logger.info(`Watcher Features Ended for project: ${rootDirectoryUri}`);
      },
    );
    this._subscriptions.add(subscription);
  }

  async close(shutdownIfLast: boolean): Promise<void> {
    logger.info('Received close command!', {
      shutdownIfLast,
      stack: Error('stack').stack,
    });
    this._subscriptions.dispose();
    await this._connection.removeConnection(this, shutdownIfLast);
    RemoteConnection._emitter.emit('did-close', this);
  }

  getConnection(): ServerConnection {
    return this._connection;
  }

  getDisplayTitle(): string {
    return this._displayTitle;
  }

  getUri(): string {
    return this.getConnection().getUriOfRemotePath(this.getPath());
  }

  getPath(): string {
    return this._path;
  }

  getConfig(): RemoteConnectionConfiguration {
    return {
      ...this._connection.getConfig(),
      path: this._path,
      displayTitle: this._displayTitle,
      promptReconnectOnFailure: this._promptReconnectOnFailure,
    };
  }

  static onDidAddRemoteConnection(
    handler: (connection: RemoteConnection) => void,
  ): IDisposable {
    return RemoteConnection._emitter.on('did-add', handler);
  }

  static onDidCloseRemoteConnection(
    handler: (connection: RemoteConnection) => void,
  ): IDisposable {
    return RemoteConnection._emitter.on('did-close', handler);
  }

  static getForUri(uri: NuclideUri): ?RemoteConnection {
    const {hostname, path} = nuclideUri.parse(uri);
    if (hostname == null) {
      return null;
    }
    return RemoteConnection.getByHostnameAndPath(hostname, path);
  }

  /**
   * Get cached connection match the hostname and the path has the prefix of connection.path.
   * @param hostname The connected server host name.
   * @param path The absolute path that's has the prefix of path of the connection.
   *   If path is null, empty or undefined, then return the connection which matches
   *   the hostname and ignore the initial working directory.
   */
  static getByHostnameAndPath(
    hostname: string,
    path: string,
  ): ?RemoteConnection {
    return RemoteConnection.getByHostname(hostname).filter(connection => {
      return nuclideUri.contains(connection.getPath(), path);
    })[0];
  }

  static getByHostname(hostname: string): Array<RemoteConnection> {
    const server = ServerConnection.getByHostname(hostname);
    return server == null ? [] : server.getConnections();
  }

  setAlwaysShutdownIfLast(alwaysShutdownIfLast: boolean): void {
    this._alwaysShutdownIfLast = alwaysShutdownIfLast;
  }

  alwaysShutdownIfLast(): boolean {
    return this._alwaysShutdownIfLast;
  }
}

function hasAtomProjectFormat(filepath) {
  const ext = nuclideUri.extname(filepath);
  return ext === '.json' || ext === '.cson' || ext === '.toml';
}

function getProjectManager(): Promise<?ProjectManager> {
  return observableFromSubscribeFunction(cb =>
    atom.packages.serviceHub.consume('nuclide.project-manager', '0.0.0', cb),
  )
    .take(1)
    .timeoutWith(100, Observable.of(null))
    .toPromise();
}
