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

import type {RemoteConnectionConfiguration} from './RemoteConnection';

import ConnectionTracker from './ConnectionTracker';
import {Client as SshConnection} from 'ssh2';
import fs from 'fs-plus';
import net from 'net';
import invariant from 'assert';
import {RemoteConnection} from './RemoteConnection';
import fsPromise from 'nuclide-commons/fsPromise';
import {sleep} from 'nuclide-commons/promise';
import lookupPreferIpv6 from './lookup-prefer-ip-v6';
import {getLogger} from 'log4js';
import {readFile as readRemoteFile} from './RemoteCommand';

const logger = getLogger('nuclide-remote-connection');

// Sync word and regex pattern for parsing command stdout.
const READY_TIMEOUT_MS = 120 * 1000;
const SFTP_TIMEOUT_MS = 20 * 1000;

// Automatically retry with a password prompt if existing authentication methods fail.
const PASSWORD_RETRIES = 3;

export type SshConnectionConfiguration = {
  host: string, // host nuclide server is running on
  sshPort: number, // ssh port of host nuclide server is running on
  family?: 4 | 6, // ipv4 or ipv6?
  username: string, // username to authenticate as
  pathToPrivateKey: string, // The path to private key
  remoteServerCommand: string, // Command to use to start server
  cwd: string, // Path to remote directory user should start in upon connection.
  authMethod: string, // Which of the authentication methods in `SupportedMethods` to use.
  password: string, // for simple password-based authentication
  displayTitle: string, // Name of the saved connection profile.
};

const SupportedMethods = Object.freeze({
  SSL_AGENT: 'SSL_AGENT',
  PASSWORD: 'PASSWORD',
  PRIVATE_KEY: 'PRIVATE_KEY',
});

const ErrorType = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  HOST_NOT_FOUND: 'HOST_NOT_FOUND',
  CANT_READ_PRIVATE_KEY: 'CANT_READ_PRIVATE_KEY',
  SSH_CONNECT_TIMEOUT: 'SSH_CONNECT_TIMEOUT',
  SSH_CONNECT_FAILED: 'SSH_CONNECT_FAILED',
  SSH_AUTHENTICATION: 'SSH_AUTHENTICATION',
  DIRECTORY_NOT_FOUND: 'DIRECTORY_NOT_FOUND',
  SERVER_START_FAILED: 'SERVER_START_FAILED',
  SERVER_CANNOT_CONNECT: 'SERVER_CANNOT_CONNECT',
  SFTP_TIMEOUT: 'SFTP_TIMEOUT',
  USER_CANCELLED: 'USER_CANCELLED',
});

export type SshHandshakeErrorType =
  | 'UNKNOWN'
  | 'HOST_NOT_FOUND'
  | 'CANT_READ_PRIVATE_KEY'
  | 'SSH_CONNECT_TIMEOUT'
  | 'SSH_CONNECT_FAILED'
  | 'SSH_AUTHENTICATION'
  | 'DIRECTORY_NOT_FOUND'
  | 'SERVER_START_FAILED'
  | 'SERVER_CANNOT_CONNECT'
  | 'SFTP_TIMEOUT'
  | 'USER_CANCELLED';

type SshConnectionErrorLevel =
  | 'client-timeout'
  | 'client-socket'
  | 'protocal'
  | 'client-authentication'
  | 'agent'
  | 'client-dns';

/**
 * The server is asking for replies to the given prompts for
 * keyboard-interactive user authentication.
 *
 * @param name is generally what you'd use as
 *     a window title (for GUI apps).
 * @param prompts is an array of { prompt: 'Password: ',
 *     echo: false } style objects (here echo indicates whether user input
 *     should be displayed on the screen).
 * @param finish: The answers for all prompts must be provided as an
 *     array of strings and passed to finish when you are ready to continue. Note:
 *     It's possible for the server to come back and ask more questions.
 */
export type KeyboardInteractiveCallback = (
  name: string,
  instructions: string,
  instructionsLang: string,
  prompts: Array<{prompt: string, echo: boolean}>,
  finish: (answers: Array<string>) => void,
) => void;

export type SshConnectionDelegate = {
  /** Invoked when server requests keyboard interaction */
  onKeyboardInteractive: KeyboardInteractiveCallback,
  /** Invoked when trying to connect */
  onWillConnect: (config: SshConnectionConfiguration) => void,
  /** Invoked when connection is sucessful */
  onDidConnect: (
    connection: RemoteConnection,
    config: SshConnectionConfiguration,
  ) => void,
  /** Invoked when connection is fails */
  onError: (
    errorType: SshHandshakeErrorType,
    error: Error,
    config: SshConnectionConfiguration,
  ) => void,
};

const SshConnectionErrorLevelMap: Map<
  SshConnectionErrorLevel,
  SshHandshakeErrorType,
> = new Map([
  ['client-timeout', ErrorType.SSH_CONNECT_TIMEOUT],
  ['client-socket', ErrorType.SSH_CONNECT_FAILED],
  ['protocal', ErrorType.SSH_CONNECT_FAILED],
  ['client-authentication', ErrorType.SSH_AUTHENTICATION],
  ['agent', ErrorType.SSH_AUTHENTICATION],
  ['client-dns', ErrorType.SSH_AUTHENTICATION],
]);

export class SshHandshake {
  static ErrorType = ErrorType;
  static SupportedMethods: typeof SupportedMethods = SupportedMethods;

  _delegate: SshConnectionDelegate;
  _connection: SshConnection;
  _config: SshConnectionConfiguration;
  _forwardingServer: net.Server;
  _remoteHost: ?string;
  _remotePort: number;
  _certificateAuthorityCertificate: Buffer;
  _clientCertificate: Buffer;
  _clientKey: Buffer;
  _passwordRetryCount: number;
  _cancelled: boolean;

  constructor(delegate: SshConnectionDelegate, connection?: SshConnection) {
    this._cancelled = false;
    this._delegate = delegate;
    this._connection = connection ? connection : new SshConnection();
    this._connection.on('ready', this._onConnect.bind(this));
    this._connection.on('error', this._onSshConnectionError.bind(this));
    this._connection.on(
      'keyboard-interactive',
      this._onKeyboardInteractive.bind(this),
    );
  }

  _willConnect(): void {
    this._delegate.onWillConnect(this._config);
  }

  _didConnect(connection: RemoteConnection): void {
    this._delegate.onDidConnect(connection, this._config);
  }

  _error(
    message: string,
    errorType: SshHandshakeErrorType,
    error: Error,
  ): void {
    logger.error(`SshHandshake failed: ${errorType}, ${message}`, error);
    this._delegate.onError(errorType, error, this._config);
  }

  _onSshConnectionError(error: Error): void {
    const errorLevel = ((error: Object).level: SshConnectionErrorLevel);
    // Upon authentication failure, fall back to using a password.
    if (
      errorLevel === 'client-authentication' &&
      this._passwordRetryCount < PASSWORD_RETRIES
    ) {
      const config = this._config;
      const retryText = this._passwordRetryCount ? ' again' : '';
      this._delegate.onKeyboardInteractive(
        '',
        '',
        '', // ignored
        [
          {
            prompt: `Authentication failed. Try entering your password${retryText}:`,
            echo: true,
          },
        ],
        ([password]) => {
          this._connection.connect({
            host: config.host,
            port: config.sshPort,
            username: config.username,
            password,
            tryKeyboard: true,
            readyTimeout: READY_TIMEOUT_MS,
          });
        },
      );
      this._passwordRetryCount++;
      return;
    }
    const errorType =
      SshConnectionErrorLevelMap.get(errorLevel) ||
      SshHandshake.ErrorType.UNKNOWN;
    this._error('Ssh connection failed.', errorType, error);
  }

  async connect(config: SshConnectionConfiguration): Promise<void> {
    this._config = config;
    this._passwordRetryCount = 0;
    this._cancelled = false;
    this._willConnect();

    const existingConnection = RemoteConnection.getByHostnameAndPath(
      this._config.host,
      this._config.cwd,
    );

    if (existingConnection) {
      this._didConnect(existingConnection);
      return;
    }

    let lookup;
    try {
      lookup = await lookupPreferIpv6(config.host);
    } catch (e) {
      return this._error(
        'Failed to resolve DNS.',
        SshHandshake.ErrorType.HOST_NOT_FOUND,
        e,
      );
    }

    const {address, family} = lookup;
    this._config.family = family;

    const connection =
      (await RemoteConnection.createConnectionBySavedConfig(
        this._config.host,
        this._config.cwd,
        this._config.displayTitle,
      )) ||
      // We save connections by their IP address as well, in case a different hostname
      // was used for the same server.
      (await RemoteConnection.createConnectionBySavedConfig(
        address,
        this._config.cwd,
        this._config.displayTitle,
      ));

    if (connection) {
      this._didConnect(connection);
      return;
    }

    if (config.authMethod === SupportedMethods.SSL_AGENT) {
      // Point to ssh-agent's socket for ssh-agent-based authentication.
      let agent = process.env.SSH_AUTH_SOCK;
      // flowlint-next-line sketchy-null-string:off
      if (!agent && /^win/.test(process.platform)) {
        // #100: On Windows, fall back to pageant.
        agent = 'pageant';
      }
      this._connection.connect({
        host: address,
        port: config.sshPort,
        username: config.username,
        agent,
        tryKeyboard: true,
        readyTimeout: READY_TIMEOUT_MS,
      });
    } else if (config.authMethod === SupportedMethods.PASSWORD) {
      // The user has already entered the password once.
      this._passwordRetryCount++;
      // When the user chooses password-based authentication, we specify
      // the config as follows so that it tries simple password auth and
      // failing that it falls through to the keyboard interactive path
      this._connection.connect({
        host: address,
        port: config.sshPort,
        username: config.username,
        password: config.password,
        tryKeyboard: true,
        readyTimeout: READY_TIMEOUT_MS,
      });
    } else if (config.authMethod === SupportedMethods.PRIVATE_KEY) {
      // We use fs-plus's normalize() function because it will expand the ~, if present.
      const expandedPath = fs.normalize(config.pathToPrivateKey);
      try {
        const privateKey = await fsPromise.readFile(expandedPath);
        this._connection.connect({
          host: address,
          port: config.sshPort,
          username: config.username,
          privateKey,
          tryKeyboard: true,
          readyTimeout: READY_TIMEOUT_MS,
        });
      } catch (e) {
        this._error(
          'Failed to read private key',
          SshHandshake.ErrorType.CANT_READ_PRIVATE_KEY,
          e,
        );
      }
    }
  }

  cancel() {
    this._cancelled = true;
    this._connection.end();
  }

  _onKeyboardInteractive(
    name: string,
    instructions: string,
    instructionsLang: string,
    prompts: Array<{prompt: string, echo: boolean}>,
    finish: (answers: Array<string>) => void,
  ): void {
    this._delegate.onKeyboardInteractive(
      name,
      instructions,
      instructionsLang,
      prompts,
      finish,
    );
  }

  _forwardSocket(socket: net.Socket): void {
    invariant(socket.remoteAddress != null);
    this._connection.forwardOut(
      socket.remoteAddress,
      socket.remotePort,
      'localhost',
      this._remotePort,
      (err, stream) => {
        if (err) {
          socket.end();
          logger.error(err);
          return;
        }
        socket.pipe(stream);
        stream.pipe(socket);
      },
    );
  }

  _updateServerInfo(serverInfo: {}) {
    invariant(typeof serverInfo.port === 'number');
    this._remotePort = serverInfo.port || 0;
    this._remoteHost =
      typeof serverInfo.hostname === 'string'
        ? serverInfo.hostname
        : this._config.host;

    // Because the value for the Initial Directory that the user supplied may have
    // been a symlink that was resolved by the server, overwrite the original `cwd`
    // value with the resolved value.
    invariant(typeof serverInfo.workspace === 'string');
    this._config.cwd = serverInfo.workspace;

    // The following keys are optional in `RemoteConnectionConfiguration`.
    //
    // Do not throw when any of them (`ca`, `cert`, or `key`) are undefined because that will be the
    // case when the server is started in "insecure" mode. See `::_isSecure`, which returns the
    // security of this connection after the server is started.
    if (typeof serverInfo.ca === 'string') {
      this._certificateAuthorityCertificate = new Buffer(serverInfo.ca);
    }
    if (typeof serverInfo.cert === 'string') {
      this._clientCertificate = new Buffer(serverInfo.cert);
    }
    if (typeof serverInfo.key === 'string') {
      this._clientKey = new Buffer(serverInfo.key);
    }
  }

  _isSecure(): boolean {
    return Boolean(
      this._certificateAuthorityCertificate &&
        this._clientCertificate &&
        this._clientKey,
    );
  }

  _startRemoteServer(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const remoteTempFile = `/tmp/nuclide-sshhandshake-${Math.random()}`;
      // TODO: escape any single quotes
      // TODO: the timeout value shall be configurable using .json file too (t6904691).
      const cmd =
        `${this._config.remoteServerCommand} --workspace=${this._config.cwd}` +
        ` --common-name=${this._config
          .host} --json-output-file=${remoteTempFile} -t 60`;

      this._connection.exec(cmd, {pty: {term: 'nuclide'}}, (err, stream) => {
        if (err) {
          this._onSshConnectionError(err);
          return resolve(false);
        }

        let stdOut = '';
        // $FlowIssue - Problem with function overloads. Maybe related to #4616, #4683, #4685, and #4669
        stream
          .on('close', async (exitCode, signal) => {
            if (exitCode !== 0) {
              if (this._cancelled) {
                this._error(
                  'Cancelled by user',
                  SshHandshake.ErrorType.USER_CANCELLED,
                  new Error(stdOut),
                );
              } else {
                this._error(
                  'Remote shell execution failed',
                  SshHandshake.ErrorType.UNKNOWN,
                  new Error(stdOut),
                );
              }
              return resolve(false);
            }

            // Some servers have max channels set to 1, so add a delay to ensure
            // the old channel has been cleaned up on the server.
            // TODO(hansonw): Implement a proper retry mechanism.
            // But first, we have to clean up this callback hell.
            await sleep(100);
            const result = await readRemoteFile(
              this._connection,
              SFTP_TIMEOUT_MS,
              remoteTempFile,
            );

            switch (result.type) {
              case 'success': {
                let serverInfo: any = null;
                try {
                  serverInfo = JSON.parse(result.data.toString());
                } catch (e) {
                  this._error(
                    'Malformed server start information',
                    SshHandshake.ErrorType.SERVER_START_FAILED,
                    new Error(result.data),
                  );
                  return resolve(false);
                }

                if (!serverInfo.success) {
                  this._error(
                    'Remote server failed to start',
                    SshHandshake.ErrorType.SERVER_START_FAILED,
                    new Error(serverInfo.logs),
                  );
                  return resolve(false);
                }

                if (!serverInfo.workspace) {
                  this._error(
                    'Could not find directory',
                    SshHandshake.ErrorType.DIRECTORY_NOT_FOUND,
                    new Error(serverInfo.logs),
                  );
                  return resolve(false);
                }

                // Update server info that is needed for setting up client.
                this._updateServerInfo(serverInfo);
                return resolve(true);
              }

              case 'timeout':
                this._error(
                  'Failed to start sftp connection',
                  SshHandshake.ErrorType.SFTP_TIMEOUT,
                  new Error(),
                );
                this._connection.end();
                return resolve(false);

              case 'fail-to-start-connection':
                this._error(
                  'Failed to start sftp connection',
                  SshHandshake.ErrorType.SERVER_START_FAILED,
                  result.error,
                );
                return resolve(false);

              case 'fail-to-transfer-data':
                this._error(
                  'Failed to transfer server start information',
                  SshHandshake.ErrorType.SERVER_START_FAILED,
                  result.error,
                );
                return resolve(false);

              default:
                (result: empty);
            }
          })
          .on('data', data => {
            stdOut += data;
          });
      });
    });
  }

  async _onConnect(): Promise<void> {
    if (!await this._startRemoteServer()) {
      return;
    }

    const connect = async (config: RemoteConnectionConfiguration) => {
      let connection = null;
      try {
        connection = await RemoteConnection.findOrCreate(config);
      } catch (e) {
        this._error(
          'Connection check failed',
          SshHandshake.ErrorType.SERVER_CANNOT_CONNECT,
          e,
        );
      }
      if (connection != null) {
        this._didConnect(connection);
        // If we are secure then we don't need the ssh tunnel.
        if (this._isSecure()) {
          this._connection.end();
        }
      }
    };

    // Use an ssh tunnel if server is not secure
    if (this._isSecure()) {
      // flowlint-next-line sketchy-null-string:off
      invariant(this._remoteHost);
      connect({
        host: this._remoteHost,
        port: this._remotePort,
        family: this._config.family,
        cwd: this._config.cwd,
        certificateAuthorityCertificate: this._certificateAuthorityCertificate,
        clientCertificate: this._clientCertificate,
        clientKey: this._clientKey,
        displayTitle: this._config.displayTitle,
      });
    } else {
      /* $FlowIssue t9212378 */
      this._forwardingServer = net
        .createServer(sock => {
          this._forwardSocket(sock);
        })
        .listen(0, 'localhost', () => {
          const localPort = this._getLocalPort();
          // flowlint-next-line sketchy-null-number:off
          invariant(localPort);
          connect({
            host: 'localhost',
            port: localPort,
            family: this._config.family,
            cwd: this._config.cwd,
            displayTitle: this._config.displayTitle,
          });
        });
    }
  }

  _getLocalPort(): ?number {
    return this._forwardingServer
      ? this._forwardingServer.address().port
      : null;
  }

  getConfig(): SshConnectionConfiguration {
    return this._config;
  }
}

export function decorateSshConnectionDelegateWithTracking(
  delegate: SshConnectionDelegate,
): SshConnectionDelegate {
  let connectionTracker;

  return {
    onKeyboardInteractive: (
      name: string,
      instructions: string,
      instructionsLang: string,
      prompts: Array<{prompt: string, echo: boolean}>,
      finish: (answers: Array<string>) => void,
    ) => {
      invariant(connectionTracker);
      connectionTracker.trackPromptYubikeyInput();
      delegate.onKeyboardInteractive(
        name,
        instructions,
        instructionsLang,
        prompts,
        answers => {
          invariant(connectionTracker);
          connectionTracker.trackFinishYubikeyInput();
          finish(answers);
        },
      );
    },
    onWillConnect: (config: SshConnectionConfiguration) => {
      connectionTracker = new ConnectionTracker(config);
      delegate.onWillConnect(config);
    },
    onDidConnect: (
      connection: RemoteConnection,
      config: SshConnectionConfiguration,
    ) => {
      invariant(connectionTracker);
      connectionTracker.trackSuccess();
      delegate.onDidConnect(connection, config);
    },
    onError: (
      errorType: SshHandshakeErrorType,
      error: Error,
      config: SshConnectionConfiguration,
    ) => {
      invariant(connectionTracker);
      connectionTracker.trackFailure(errorType, error);
      delegate.onError(errorType, error, config);
    },
  };
}
