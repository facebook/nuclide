/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {BigDigClient} from './BigDigClient';

import net from 'net';
import invariant from 'assert';
import {Client as SshConnection} from 'ssh2';
import fs from '../common/fs';
import {sleep} from 'nuclide-commons/promise';
import {shellQuote} from 'nuclide-commons/string';
import {tempfile} from '../common/temp';
import ConnectionTracker from './ConnectionTracker';
import lookupPreferIpv6 from './lookup-prefer-ip-v6';
import createBigDigClient from './createBigDigClient';

// TODO
function restoreBigDigClient(address: string) {}

export type RemoteConnectionConfiguration = {
  host: string, // host nuclide server is running on.
  port: number, // port to connect to.
  certificateAuthorityCertificate?: Buffer, // certificate of certificate authority.
  clientCertificate?: Buffer, // client certificate for https connection.
  clientKey?: Buffer, // key for https connection.
};

// Sync word and regex pattern for parsing command stdout.
const READY_TIMEOUT_MS = 120 * 1000;
const SFTP_TIMEOUT_MS = 20 * 1000;

// Automatically retry with a password prompt if existing authentication methods fail.
const PASSWORD_RETRIES = 3;

export type SshConnectionConfiguration = {
  host: string, // host nuclide server is running on
  sshPort: number, // ssh port of host nuclide server is running on
  username: string, // username to authenticate as
  pathToPrivateKey: string, // The path to private key
  remoteServerCommand: string, // Command to use to start server
  remoteServerPort?: number, // Port remote server should run on (defaults to 0)
  remoteServerCustomParams?: Object, // JSON-serializable params.
  authMethod: string, // Which of the authentication methods in `SupportedMethods` to use.
  password: string, // for simple password-based authentication
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
    connection: BigDigClient,
    config: SshConnectionConfiguration,
  ) => mixed,
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
  _remotePort: ?number;
  _certificateAuthorityCertificate: Buffer;
  _clientCertificate: Buffer;
  _clientKey: Buffer;
  _passwordRetryCount: number;
  _cancelled: boolean;

  constructor(delegate: SshConnectionDelegate, connection?: SshConnection) {
    this._cancelled = false;
    this._delegate = delegate;
    this._connection = connection ? connection : new SshConnection();
    this._connection.on('ready', () => this._onSshConnectionIsReady());
    this._connection.on('error', this._onSshConnectionError.bind(this));
    this._connection.on(
      'keyboard-interactive',
      this._onKeyboardInteractive.bind(this),
    );
  }

  _willConnect(): void {
    this._delegate.onWillConnect(this._config);
  }

  _didConnect(connection: BigDigClient): void {
    this._delegate.onDidConnect(connection, this._config);
  }

  _error(
    message: string,
    errorType: SshHandshakeErrorType,
    error: Error,
  ): void {
    // eslint-disable-next-line no-console
    console.error(`SshHandshake failed: ${errorType}, ${message}`, error);
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
            prompt: `Authentication failed. Try entering your password${retryText}: `,
            echo: false,
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

    let address;
    try {
      address = await lookupPreferIpv6(config.host);
    } catch (e) {
      return this._error(
        'Failed to resolve DNS.',
        SshHandshake.ErrorType.HOST_NOT_FOUND,
        e,
      );
    }

    const connection =
      (await restoreBigDigClient(this._config.host)) ||
      // We save connections by their IP address as well, in case a different hostname
      // was used for the same server.
      (await restoreBigDigClient(address));

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
      // Note that if the path the user entered contains a ~, the calling function is responsible
      // for doing the expansion before it is passed in.
      const expandedPath = config.pathToPrivateKey;
      let privateKey;
      try {
        privateKey = await fs.readFileAsBuffer(expandedPath);
      } catch (e) {
        this._error(
          `Failed to read private key at ${expandedPath}.`,
          SshHandshake.ErrorType.CANT_READ_PRIVATE_KEY,
          e,
        );
        return;
      }

      try {
        this._connection.connect({
          host: address,
          port: config.sshPort,
          username: config.username,
          privateKey,
          tryKeyboard: true,
          readyTimeout: READY_TIMEOUT_MS,
        });
      } catch (e) {
        if (
          e.message ===
          'Encrypted private key detected, but no passphrase given'
        ) {
          this._delegate.onKeyboardInteractive(
            '',
            '',
            '', // ignored
            [
              {
                prompt:
                  'Encrypted private key detected, but no passphrase given.\n' +
                  `Enter passphrase for ${config.pathToPrivateKey}: `,
                echo: false,
              },
            ],
            ([passphrase]) => {
              this._connection.connect({
                host: config.host,
                port: config.sshPort,
                username: config.username,
                privateKey,
                passphrase,
                tryKeyboard: true,
                readyTimeout: READY_TIMEOUT_MS,
              });
            },
          );
          this._passwordRetryCount++;
          return;
        }

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
    this._connection.forwardOut(
      socket.remoteAddress,
      socket.remotePort,
      'localhost',
      this._remotePort,
      (err, stream) => {
        if (err) {
          socket.end();
          console.error(err); // eslint-disable-line no-console
          return;
        }
        socket.pipe(stream);
        stream.pipe(socket);
      },
    );
  }

  _updateServerInfo(serverInfo: {}) {
    invariant(typeof serverInfo.port === 'number');
    this._remotePort = serverInfo.port;
    this._remoteHost =
      typeof serverInfo.hostname === 'string'
        ? serverInfo.hostname
        : this._config.host;

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
    let sftpTimer = null;
    return new Promise((resolve, reject) => {
      let stdOut = '';
      const remoteTempFile = `/tmp/nuclide-sshhandshake-${Math.random()}`;
      const params = {
        cname: this._config.host,
        jsonOutputFile: remoteTempFile,
        timeout: '60s', // Currently unused and not configurable.
        expiration: '7d',
        serverParams: this._config.remoteServerCustomParams,
        port: this._config.remoteServerPort,
      };
      const cmd = `${this._config.remoteServerCommand} ${shellQuote([
        JSON.stringify(params),
      ])}`;

      this._connection.exec(cmd, {pty: {term: 'nuclide'}}, (err, stream) => {
        if (err) {
          this._onSshConnectionError(err);
          return resolve(false);
        }
        stream
          .on('close', async (code, signal) => {
            // Note: this code is probably the code from the child shell if one
            // is in use.
            if (code === 0) {
              // Some servers have max channels set to 1, so add a delay to ensure
              // the old channel has been cleaned up on the server.
              // TODO(hansonw): Implement a proper retry mechanism.
              // But first, we have to clean up this callback hell.
              await sleep(100);
              sftpTimer = setTimeout(() => {
                this._error(
                  'Failed to start sftp connection',
                  SshHandshake.ErrorType.SFTP_TIMEOUT,
                  new Error(),
                );
                sftpTimer = null;
                this._connection.end();
                resolve(false);
              }, SFTP_TIMEOUT_MS);
              this._connection.sftp(async (error, sftp) => {
                if (sftpTimer != null) {
                  // Clear the sftp timer once we get a response.
                  clearTimeout(sftpTimer);
                } else {
                  // If the timer already triggered, we timed out. Just exit.
                  return;
                }
                if (error) {
                  this._error(
                    'Failed to start sftp connection',
                    SshHandshake.ErrorType.SERVER_START_FAILED,
                    error,
                  );
                  return resolve(false);
                }
                const localTempFile = await tempfile();
                sftp.fastGet(remoteTempFile, localTempFile, async sftpError => {
                  sftp.end();
                  if (sftpError) {
                    this._error(
                      'Failed to transfer server start information',
                      SshHandshake.ErrorType.SERVER_START_FAILED,
                      sftpError,
                    );
                    return resolve(false);
                  }

                  let serverInfo: any = null;
                  const serverInfoJson = await fs.readFileAsString(
                    localTempFile,
                    'utf8',
                  );
                  try {
                    serverInfo = JSON.parse(serverInfoJson);
                  } catch (e) {
                    this._error(
                      'Malformed server start information',
                      SshHandshake.ErrorType.SERVER_START_FAILED,
                      new Error(serverInfoJson),
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

                  // Update server info that is needed for setting up client.
                  this._updateServerInfo(serverInfo);
                  return resolve(true);
                });
              });
            } else {
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
          })
          .on('data', data => {
            stdOut += data;
          });
      });
    });
  }

  /**
   * This is called when the SshConnection is ready.
   */
  async _onSshConnectionIsReady(): Promise<void> {
    if (!await this._startRemoteServer()) {
      return;
    }

    // Use an ssh tunnel if server is not secure
    if (this._isSecure()) {
      // flowlint-next-line sketchy-null-string:off
      invariant(this._remoteHost);
      // flowlint-next-line sketchy-null-number:off
      invariant(this._remotePort);
      this._establishBigDigClient({
        host: this._remoteHost,
        port: this._remotePort,
        certificateAuthorityCertificate: this._certificateAuthorityCertificate,
        clientCertificate: this._clientCertificate,
        clientKey: this._clientKey,
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
          this._establishBigDigClient({
            host: 'localhost',
            port: localPort,
          });
        });
    }
  }

  /**
   * Now that the remote server has been started, create the BigDigClient to talk to it and
   * pass it to the _didConnect() callback.
   */
  async _establishBigDigClient(
    config: RemoteConnectionConfiguration,
  ): Promise<void> {
    let bigDigClient = null;
    try {
      bigDigClient = await createBigDigClient(config);
    } catch (e) {
      this._error(
        'Connection check failed',
        SshHandshake.ErrorType.SERVER_CANNOT_CONNECT,
        e,
      );
    }

    if (bigDigClient != null) {
      this._didConnect(bigDigClient);
      // If we are secure then we don't need the ssh tunnel.
      if (this._isSecure()) {
        this._connection.end();
      }
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
      connection: BigDigClient,
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
