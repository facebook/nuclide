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

import * as vscode from 'vscode';
import type {
  ExtractionMethod,
  ServerExecutable,
} from 'big-dig/src/client/SshHandshake';
import type {
  DeployServer,
  AuthenticationMethod,
  IConnectionProfile,
} from './configuration';

import {SshHandshake, createBigDigClient} from 'big-dig/src/client';
import {setPassword, getPassword} from 'nuclide-prebuilt-libs/keytar';
import {getConnectionIdForCredentialStore} from './configuration';
import {getLogger} from 'log4js';
import {timeoutPromise} from 'nuclide-commons/promise';

import connectionPrompt from './ConnectionPrompt';
import {packageServerZip, serverPackageZipVersion} from './server-deployment';
import {ConnectionWrapper} from './ConnectionWrapper';

const logger = getLogger('remote');
// Time to wait (ms) until giving up on getting the server version during the
// validation step.
const SERVER_VERSION_TIMEOUT = 5000;
// Time to wait (ms) before giving up on the server acknowledging a request to
// shutdown.
const SERVER_SHUTDOWN_TIMEOUT = 2000;

type Credentials = {
  certificateAuthorityCertificate: string,
  clientCertificate: string,
  clientKey: string,
  port: number,
};

/**
 * Cache the credentials so we can handle reconnections without necessarily
 * prompting the user to authenticate again.
 */
const CREDENTIALS_SERVICE = 'big-dig-vscode';

async function saveCredentials(
  hostname: string,
  credentials: Credentials,
): Promise<void> {
  try {
    await setPassword(
      CREDENTIALS_SERVICE,
      hostname,
      JSON.stringify(credentials),
    );
  } catch (err) {
    logger.warn('Unable to store credentials', err);
  }
}

async function getCredentials(hostname: string): Promise<?Credentials> {
  const password = await getPassword(CREDENTIALS_SERVICE, hostname);
  if (password != null) {
    return JSON.parse(password);
  }
  return null;
}

function getExtractCommand(server: DeployServer): ExtractionMethod {
  const {extractFileCommand} = server;
  if (extractFileCommand != null) {
    return {
      fromFileCommand: (archive: string, dst: string) =>
        extractFileCommand.replace('${file}', archive).replace('${dest}', dst),
    };
  } else {
    return {
      fromFileCommand: (archive: string, dst: string) =>
        `unzip -oq ${archive} -d ${dst}`,
    };
  }
}

function getServer(profile: IConnectionProfile): ServerExecutable {
  const {node, installationPath} = profile.deployServer;
  return {
    package: packageServerZip,
    command: (installPath, args) => `${node} ${installPath} ${args}`,
    installationPath,
    expectedVersion: current => serverPackageZipVersion(),
    extract: getExtractCommand(profile.deployServer),
  };
}

/**
 * If the server is running the wrong version, tell it to shut down; we will
 * create a new instance (by returning `false` here).
 * Note: even if the server does not shut down, the new instance will kill the
 * existing process.
 * @returns `true` if the server is running the correct version.
 */
async function validateCurrentServer(
  conn: ConnectionWrapper,
): Promise<boolean> {
  const {version: serverVersion} = await timeoutPromise(
    conn.getServerStatus(),
    SERVER_VERSION_TIMEOUT,
  );
  logger.info(`Server version: ${serverVersion}`);
  const expectedVersion = await serverPackageZipVersion();
  if (expectedVersion !== serverVersion) {
    logger.info(
      `Expected server version ${expectedVersion}; shutting server down...`,
    );
    await timeoutPromise(conn.shutdown(), SERVER_SHUTDOWN_TIMEOUT).catch(
      () => {},
    );
    return false;
  }
  // The server is the correct version
  return true;
}

export async function makeConnection(
  profile: IConnectionProfile,
): Promise<ConnectionWrapper> {
  const canceller = new vscode.CancellationTokenSource();
  const progressConfig = {
    location: vscode.ProgressLocation.Window,
    title: `Connecting to ${profile.address}`,
  };

  try {
    return await vscode.window.withProgress(
      progressConfig,
      connectOrReconnect.bind(null, profile, canceller),
    );
  } finally {
    canceller.dispose();
  }
}

async function connectOrReconnect(
  profile: IConnectionProfile,
  canceller: vscode.CancellationTokenSource,
  progress: vscode.Progress<{message?: string}>,
): Promise<ConnectionWrapper> {
  const {
    address,
    deployServer,
    authMethod: authMethodPromise,
    ports,
    privateKey: privateKeyPromise,
    username,
  } = profile;
  const server = getServer(profile);
  const {autoUpdate} = deployServer;
  const connectionId = getConnectionIdForCredentialStore(profile);
  const checkServer =
    deployServer.validateServerVersion != null
      ? deployServer.validateServerVersion
      : true;

  let connectionWrapper = await doReconnect(
    connectionId,
    address,
    checkServer,
    progress,
  );

  if (connectionWrapper == null) {
    connectionWrapper = await doConnect(
      connectionId,
      address,
      autoUpdate,
      canceller,
      authMethodPromise,
      privateKeyPromise,
      username,
      server,
      ports,
      progress,
    );
  }

  return connectionWrapper;
}

async function doConnect(
  connectionId: string,
  address: string,
  autoUpdate: boolean,
  canceller: vscode.CancellationTokenSource,
  authMethodPromise: Promise<AuthenticationMethod>,
  privateKeyPromise: Promise<string>,
  username: string,
  server: ServerExecutable,
  ports: string,
  progress: vscode.Progress<{message?: string}>,
): Promise<ConnectionWrapper> {
  const sshConnectionDelegate = {
    onKeyboardInteractive: connectionPrompt(progress, {
      hostname: address,
      autoUpdate,
      canceller,
    }),
    onWillConnect() {},
    onDidConnect(connectionConfig, config) {},
    onError(errorType, error, config) {
      // No need to log here because SshHandshake.connect() already logs any
      // errors.
    },
  };

  const sshHandshake = new SshHandshake(sshConnectionDelegate);

  canceller.token.onCancellationRequested(() => sshHandshake.cancel());

  let authMethod;
  // TODO(T27503297): It does not make sense to set pathToPrivateKey when
  // password auth is set. We should tighten up the Flow types so that
  // SshConnectionConfiguration has a single authentication property that is a
  // tagged union where each value in the union includes only the data
  // necessary to support the authentication mechanism.
  let pathToPrivateKey;
  const userAuthMethod = await authMethodPromise;

  switch (userAuthMethod) {
    case 'ssl-agent':
      authMethod = 'SSL_AGENT';
      break;
    case 'private-key':
      authMethod = 'PRIVATE_KEY';
      pathToPrivateKey = await privateKeyPromise;
      break;
    case 'password':
      authMethod = 'PASSWORD';
      pathToPrivateKey = ''; // Dummy value.
      break;
    default:
      (userAuthMethod: empty);
      throw new Error(`Unhandled userAuthMethod: ${userAuthMethod}`);
  }

  const [connectionConfig] = await sshHandshake.connect({
    host: address,
    sshPort: 22,
    username,
    pathToPrivateKey,
    authMethod,
    remoteServer: server,
    remoteServerPorts: ports,
    // We set password to the empty string so that if
    // SshHandshake._connectFallbackViaPassword() is called, it does not
    // appear as though the user has attempted a password yet.
    password: '',
    exclusive: 'vscode',
  });

  const bigDigClient = await createBigDigClient({
    ...connectionConfig,
    ignoreIntransientErrors: false,
  });

  const {
    certificateAuthorityCertificate,
    clientCertificate,
    clientKey,
    port,
  } = connectionConfig;
  if (
    certificateAuthorityCertificate != null &&
    clientCertificate != null &&
    clientKey != null
  ) {
    await saveCredentials(connectionId, {
      certificateAuthorityCertificate: certificateAuthorityCertificate.toString(),
      clientCertificate: clientCertificate.toString(),
      clientKey: clientKey.toString(),
      port,
    });
  }
  return new ConnectionWrapper(bigDigClient);
}

async function doReconnect(
  connectionId: string,
  address: string,
  validateServerVersion: boolean,
  progress: vscode.Progress<{message?: string}>,
): Promise<?ConnectionWrapper> {
  try {
    // Attempt to reconnect using cached credentials
    const credentials = await getCredentials(connectionId);
    if (credentials != null) {
      progress.report({message: `Reconnecting to ${address}...`});
      const bigDigClient = await createBigDigClient({
        ...credentials,
        host: address,
        // TODO(hansonw): Resolve the family of the hostname, preferring IPv6.
        ignoreIntransientErrors: false,
      });
      const conn = new ConnectionWrapper(bigDigClient);
      const compatible = validateServerVersion
        ? await validateCurrentServer(conn)
        : true;

      if (!compatible) {
        conn.dispose();
        return null;
      } else {
        return conn;
      }
    }
  } catch (error) {
    logger.info(`Could not automatically reconnect to ${address}`, error);
    return null;
  }
}
