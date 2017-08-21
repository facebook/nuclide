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
  SshConnectionConfiguration,
  SshHandshakeErrorType,
} from '../../nuclide-remote-connection/lib/SshHandshake';

import {SshHandshake} from '../../nuclide-remote-connection';
import nuclideUri from 'nuclide-commons/nuclideUri';

export function notifyLocalDiskFile(fileUri: string): void {
  atom.notifications.addInfo(
    `File <code>${fileUri}</code> exists on the local filesystem.`,
  );
}

export function notifyConnectedRemoteFile(fileUri: string): void {
  atom.notifications.addInfo(
    `The connection to the server: <code>${nuclideUri.getHostname(
      fileUri,
    )}</code> is healthy.`,
  );
}

export function notifyDisconnectedRemoteFile(fileUri: string): void {
  atom.notifications.addError(
    `The connection to the server: <code>${nuclideUri.getHostname(
      fileUri,
    )}</code> is lost,
    retrying in the background!`,
  );
}

export function notifySshHandshakeError(
  errorType: SshHandshakeErrorType,
  error: Error,
  config: SshConnectionConfiguration,
): void {
  let message = '';
  let detail = '';
  const originalErrorDetail = `Original error message:\n ${error.message}`;
  const createTimeoutDetail = () =>
    'Troubleshooting:\n' +
    `Make sure you can run "sftp ${config.host}" on the command line.\n` +
    'Check your .bashrc / .bash_profile for extraneous output.\n' +
    'You may need to add the following to the top of your .bashrc:\n' +
    '  [ -z "$PS1" ] && return';

  switch (errorType) {
    case SshHandshake.ErrorType.HOST_NOT_FOUND:
      message = `Can't resolve IP address for host ${config.host}.`;
      detail =
        'Troubleshooting:\n' +
        '  1. Check your network connection.\n' +
        `  2. Make sure the hostname ${config.host} is valid.\n`;
      break;
    case SshHandshake.ErrorType.CANT_READ_PRIVATE_KEY:
      message = `Can't read content of private key path ${config.pathToPrivateKey}.`;
      detail =
        'Make sure the private key path is properly configured.\n' +
        'You may need to convert your private key from PKCS to RSA.\n' +
        originalErrorDetail;
      break;
    case SshHandshake.ErrorType.SSH_CONNECT_TIMEOUT:
      message = `Timeout while connecting to ${config.host}.`;
      detail =
        'Troubleshooting:\n' +
        '  1. Check your network connection.\n' +
        '  2. Input correct 2Fac passcode when prompted.';
      break;
    case SshHandshake.ErrorType.SFTP_TIMEOUT:
      message = `Timeout while connecting to ${config.host}.`;
      detail = createTimeoutDetail();
      break;
    case SshHandshake.ErrorType.USER_CANCELLED:
      message = `User cancelled while connecting to ${config.host}.`;
      detail = createTimeoutDetail();
      break;
    case SshHandshake.ErrorType.SSH_CONNECT_FAILED:
      message = `Failed to connect to ${config.host}:${config.sshPort}.`;
      detail =
        'Troubleshooting:\n' +
        '  1. Check your network connection.\n' +
        `  2. Make sure the host ${config.host} is running and has` +
        ` ssh server running on ${config.sshPort}.\n\n` +
        originalErrorDetail;
      break;
    case SshHandshake.ErrorType.SSH_AUTHENTICATION:
      switch (config.authMethod) {
        case SshHandshake.SupportedMethods.PASSWORD:
          message = 'Password Authentication failed';
          detail =
            'Troubleshooting:\n' +
            '  1. Did you mean to choose password authentication?\n' +
            '  2. Make sure you provided the correct username and password.';
          break;
        case SshHandshake.SupportedMethods.PRIVATE_KEY:
          message = 'Private Key Authentication failed';
          detail =
            'Troubleshooting:\n' +
            '  1. Did you mean to choose private key authentication?\n' +
            '  2. Make sure your SSH private key is properly configured.';
          break;
        case SshHandshake.SupportedMethods.SSL_AGENT:
          message = 'SSL Agent Authentication failed';
          detail =
            'Troubleshooting:\n' +
            '  1. Did you mean to choose SSL agent authentication?\n' +
            '  2. Make sure your SSH connection is properly configured.';
          break;
        default:
          message = 'Unknown SSH Authentication Method failed';
          detail =
            `Unknown authentication method '${config.authMethod}' provided. Make sure your` +
            ' SSH connection is properly configured.';
          break;
      }
      break;
    case SshHandshake.ErrorType.DIRECTORY_NOT_FOUND:
      message = `There is no such directory ${config.cwd} on ${config.host}.`;
      detail = `Make sure ${config.cwd} exists on ${config.host}.`;
      break;
    case SshHandshake.ErrorType.SERVER_START_FAILED:
      message =
        `Failed to start nuclide-server on ${config.host} using  ` +
        `${config.remoteServerCommand}`;
      detail =
        'Troubleshooting: \n' +
        `  1. Make sure the command "${config.remoteServerCommand}" is correct.\n` +
        '  2. The server might take longer to start up than expected, try to connect again.\n' +
        `  3. If none of above works, ssh to ${config.host} and kill existing nuclide-server` +
        ' by running "killall node", and reconnect.';
      break;
    case SshHandshake.ErrorType.SERVER_CANNOT_CONNECT:
      message = 'Unable to connect to server';
      detail =
        'The server successfully started, but we were unable to connect.\n\n' +
        originalErrorDetail;
      break;
    default:
      message = `Unexpected error occurred: ${error.message}.`;
      detail = originalErrorDetail;
  }
  atom.notifications.addError(message, {detail, dismissable: true});
}
