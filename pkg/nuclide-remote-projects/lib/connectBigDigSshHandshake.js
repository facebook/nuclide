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

import type {
  SshHandshakeErrorType,
  SshConnectionConfiguration,
  RemoteConnectionConfiguration,
} from 'big-dig/src/client/SshHandshake';
import type {
  SshConnectionConfiguration as NuclideSshConnectionConfigurationType,
  SshConnectionDelegate as NuclideSshConnectionDelegateType,
} from '../../nuclide-remote-connection/lib/SshHandshake';

import {SshHandshake} from 'big-dig/src/client/index';
import {SupportedMethods} from 'big-dig/src/client/SshHandshake';
import yargs from 'yargs';
import fs from 'fs-plus';
import {getNuclideVersion} from 'nuclide-commons/system-info';
import {
  SshHandshake as NuclideSshHandshake,
  RemoteConnection,
} from '../../nuclide-remote-connection';
import {BIG_DIG_VERSION} from '../../nuclide-remote-connection/lib/ServerConnection';
// @fb-only: import {getAllFacebookCAs, getCert} from 'fb-cert-tools';
import {getAllFacebookCAs, getCert} from './cert-stubs'; // @oss-only

/**
 * Adapts big-dig's SshHandshake to what Nuclide expects.
 * After the migration is complete, we should be able to refactor this away.
 */
export default function connectBigDigSshHandshake(
  connectionConfig: NuclideSshConnectionConfigurationType,
  delegate: NuclideSshConnectionDelegateType,
): SshHandshake {
  const useRootCanalCerts =
    connectionConfig.authMethod === SupportedMethods.ROOTCANAL;

  let clientCertificate = null;
  let certificateAuthorityCertificate = null;
  let clientKey = null;
  if (useRootCanalCerts) {
    clientCertificate = getCert();
    certificateAuthorityCertificate = getAllFacebookCAs();
    // When the server is requesting a cert, it requires the
    // clientKey to be set to the client cert, or else it won't
    // be sent. I don't understand the exact mechanism behind why
    // that's happening, but it seems to be required.
    clientKey = clientCertificate;
  }

  const sshHandshake = new SshHandshake({
    onKeyboardInteractive(name, instructions, instructionsLang, prompts) {
      const prompt = prompts[0];
      return new Promise(resolve => {
        switch (prompt.kind) {
          case 'ssh':
          case 'private-key':
            delegate.onKeyboardInteractive(
              name,
              instructions,
              instructionsLang,
              [{prompt: prompt.prompt, echo: prompt.echo}],
              resolve,
            );
            break;
          default:
            // No need to handle update/install for unmanaged startups.
            throw new Error('Unexpected prompt kind');
        }
      });
    },
    onWillConnect(config: SshConnectionConfiguration) {
      delegate.onWillConnect(connectionConfig);
    },
    onDidConnect(
      remoteConfig: RemoteConnectionConfiguration,
      config: SshConnectionConfiguration,
    ) {
      RemoteConnection.findOrCreate({
        ...remoteConfig,
        path: connectionConfig.cwd,
        displayTitle: connectionConfig.displayTitle,
        version: BIG_DIG_VERSION,
      }).then(
        connection => {
          delegate.onDidConnect(connection, connectionConfig);
        },
        err => {
          delegate.onError(
            err.code === 'CERT_NOT_YET_VALID'
              ? NuclideSshHandshake.ErrorType.CERT_NOT_YET_VALID
              : NuclideSshHandshake.ErrorType.SERVER_CANNOT_CONNECT,
            err,
            connectionConfig,
          );
        },
      );
    },
    onError(
      errorType: SshHandshakeErrorType,
      error: Error,
      config: SshConnectionConfiguration,
    ) {
      const nuclideErrorType =
        NuclideSshHandshake.ErrorType[(errorType: any)] ||
        NuclideSshHandshake.ErrorType.UNKNOWN;
      delegate.onError(nuclideErrorType, error, connectionConfig);
    },
  });
  const {
    host,
    sshPort,
    username,
    pathToPrivateKey,
    authMethod,
    password,
  } = connectionConfig;
  let {remoteServerCommand} = connectionConfig;
  // If the user does not specify --port or -p in the remoteServerCommand, then
  // we default to '9093-9091' as the port range. Currently, we do not give the
  // user a way to specify their own port range from the connection dialog.
  // We can straighten this out once we completely cutover to Big Dig.
  let remoteServerPorts = '9093-9091';
  // Add the current Nuclide version, unless explicitly provided.
  let version = getNuclideVersion();
  // We'll only allow one Nuclide server per user - but you can override this.
  let exclusive = 'atom';
  // Keep an array of flags to send to the bootstrap service
  const flags = [];
  // commandNoArgs will be the command without any additional flags
  let commandNoArgs = remoteServerCommand;

  // big-dig doesn't parse extra arguments.
  // We'll try to adapt commonly used ones for now.
  if (remoteServerCommand.includes(' ')) {
    const parsed = yargs.parse(remoteServerCommand);
    remoteServerCommand = parsed._.join(' ');
    commandNoArgs = parsed._[0];
    if (parsed.version != null) {
      version = parsed.version;
    }
    if (typeof parsed.port === 'number') {
      remoteServerPorts = String(parsed.port);
    }
    if (typeof parsed.p === 'number') {
      remoteServerPorts = String(parsed.p);
    }
    if (typeof parsed.exclusive === 'string') {
      exclusive = parsed.exclusive;
    }
  }

  // We use fs-plus's normalize() function because it will expand the ~, if present.
  const expandedPath = fs.normalize(pathToPrivateKey);

  // Add an extra flag to indicate the use of big-dig.
  remoteServerCommand += ' --big-dig';
  flags.push('--big-dig');
  remoteServerCommand += ` --version=${version}`;
  flags.push(`--version=${version}`);

  sshHandshake.connect({
    host,
    sshPort,
    username,
    pathToPrivateKey: expandedPath,
    remoteServer: {
      command: remoteServerCommand,
      commandNoArgs,
      flags,
    },
    remoteServerPorts,
    authMethod,
    password,
    exclusive,
    useRootCanalCerts,
    clientCertificate,
    certificateAuthorityCertificate,
    clientKey,
  });
  return sshHandshake;
}
