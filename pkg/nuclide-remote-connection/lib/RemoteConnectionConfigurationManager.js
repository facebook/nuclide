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

/* global localStorage */

import type {
  ServerConnectionConfiguration,
  ServerConnectionVersion,
} from './ServerConnection';

import crypto from 'crypto';
import invariant from 'assert';
import {getLogger} from 'log4js';
import * as keytar from 'nuclide-prebuilt-libs/keytar';
import electron from 'electron';

const CONFIG_DIR = 'nuclide-connections';
const logger = getLogger('nuclide-remote-connection');
const remote = electron.remote;
const ipc = electron.ipcRenderer;

invariant(remote);
invariant(ipc);

export const SERVER_CONFIG_RESPONSE_EVENT = 'server-config-response';
export const SERVER_CONFIG_REQUEST_EVENT = 'server-config-request';

/**
 * Version of ServerConnectionConfiguration that uses string instead of Buffer for fields so it can
 * be translated directly to/from JSON.
 */
type SerializableServerConnectionConfiguration = {
  host: string,
  port: number,
  family?: 4 | 6,
  certificateAuthorityCertificate?: string | Array<string>,
  clientCertificate?: string,
  clientKey?: string,
  version?: ServerConnectionVersion,
};

// Insecure configs are used for testing only.
function isInsecure(config: ServerConnectionConfiguration): boolean {
  return (
    config.clientKey == null &&
    config.clientCertificate == null &&
    config.certificateAuthorityCertificate == null
  );
}

function getStorageKey(host: string): string {
  return `${CONFIG_DIR}:${host}`;
}

async function getConnectionConfigViaIPC(
  host: string,
): Promise<?ServerConnectionConfiguration> {
  const thisWindowsId = remote.getCurrentWindow().id;
  const otherWindows = remote.BrowserWindow.getAllWindows().filter(
    win => win.isVisible() && win.id !== thisWindowsId,
  );
  const timeoutInMilliseconds = 5000;

  return new Promise(resolve => {
    if (otherWindows.length === 0) {
      resolve(null);
      return;
    }

    let responseCount = 0;

    // set a timeout to remove all listeners and resolve if
    // we don't get responses in some fixed amount of time
    const timeout = setTimeout(() => {
      logger.error('timed out waiting for ipc response(s) from other windows');
      resolve(null);
      ipc.removeAllListeners(SERVER_CONFIG_RESPONSE_EVENT);
    }, timeoutInMilliseconds);

    ipc.on(
      SERVER_CONFIG_RESPONSE_EVENT,
      (event, config: ?ServerConnectionConfiguration) => {
        responseCount++;

        if (config != null || responseCount === otherWindows.length) {
          if (config != null) {
            logger.info('received the config! removing other listeners');
          }
          resolve(config);
          clearTimeout(timeout);
          ipc.removeAllListeners(SERVER_CONFIG_RESPONSE_EVENT);
        }
      },
    );

    otherWindows.forEach(window => {
      logger.info(`requesting config from window ${window.id}`);

      // NOTE: I tried using sendTo here but it wasn't working well
      // (seemed like it was flaky). It might be worth trying it
      // again after we upgrade electron
      window.webContents.send(SERVER_CONFIG_REQUEST_EVENT, host, thisWindowsId);
    });
  });
}

export async function getConnectionConfig(
  host: string,
): Promise<?ServerConnectionConfiguration> {
  const storedConfig = localStorage.getItem(getStorageKey(host));
  if (storedConfig == null) {
    return null;
  }
  try {
    return await decryptConfig(JSON.parse(storedConfig));
  } catch (e) {
    logger.error(`The configuration file for ${host} is corrupted.`, e);

    logger.info('falling back to getting the config via ipc');
    const config = await getConnectionConfigViaIPC(host);

    return config;
  }
}

export async function setConnectionConfig(
  config: ServerConnectionConfiguration,
  ipAddress: string,
): Promise<void> {
  // Don't attempt to store insecure connections.
  // Insecure connections are used for testing and will fail the encryption call below.
  if (isInsecure(config)) {
    return;
  }

  try {
    const encrypted = JSON.stringify(await encryptConfig(config));
    localStorage.setItem(getStorageKey(config.host), encrypted);
    // Store configurations by their IP address as well.
    // This way, multiple aliases for the same hostname can reuse a single connection.
    localStorage.setItem(getStorageKey(ipAddress), encrypted);
  } catch (e) {
    logger.error(`Failed to store configuration file for ${config.host}.`, e);
  }
}

export async function clearConnectionConfig(host: string): Promise<void> {
  try {
    localStorage.removeItem(getStorageKey(host));
  } catch (e) {
    logger.error(`Failed to clear configuration for ${host}.`, e);
  }
}

/**
 * Encrypts the clientKey of a ConnectionConfig.
 * @param remoteProjectConfig - The config with the clientKey we want encrypted.
 * @return returns the passed in config with the clientKey encrypted.
 */
async function encryptConfig(
  remoteProjectConfig: ServerConnectionConfiguration,
): Promise<SerializableServerConnectionConfiguration> {
  const sha1 = crypto.createHash('sha1');
  sha1.update(`${remoteProjectConfig.host}:${remoteProjectConfig.port}`);
  const sha1sum = sha1.digest('hex');

  const {
    certificateAuthorityCertificate,
    clientCertificate,
    clientKey,
  } = remoteProjectConfig;
  invariant(clientKey);
  const realClientKey = clientKey.toString(); // Convert from Buffer to string.
  const {salt, password, encryptedString} = encryptString(realClientKey);
  await keytar.setPassword('nuclide.remoteProjectConfig', sha1sum, password);

  const clientKeyWithSalt = encryptedString + '.' + salt;

  invariant(certificateAuthorityCertificate);
  invariant(clientCertificate);

  let ca: Array<string> | string = [];
  if (Array.isArray(certificateAuthorityCertificate)) {
    ca = certificateAuthorityCertificate;
  } else {
    ca = certificateAuthorityCertificate.toString();
  }

  return {
    host: remoteProjectConfig.host,
    port: remoteProjectConfig.port,
    family: remoteProjectConfig.family,
    certificateAuthorityCertificate: ca,
    clientCertificate: clientCertificate.toString(),
    clientKey: clientKeyWithSalt,
    version: remoteProjectConfig.version,
  };
}

/**
 * Decrypts the clientKey of a SerializableServerConnectionConfiguration.
 * @param remoteProjectConfig - The config with the clientKey we want encrypted.
 * @return returns the passed in config with the clientKey encrypted.
 */
async function decryptConfig(
  remoteProjectConfig: SerializableServerConnectionConfiguration,
): Promise<ServerConnectionConfiguration> {
  const sha1 = crypto.createHash('sha1');
  sha1.update(`${remoteProjectConfig.host}:${remoteProjectConfig.port}`);
  const sha1sum = sha1.digest('hex');

  const password = await keytar.getPassword(
    'nuclide.remoteProjectConfig',
    sha1sum,
  );

  if (password == null) {
    throw new Error('Cannot find password for encrypted client key');
  }

  const {
    certificateAuthorityCertificate,
    clientCertificate,
    clientKey,
  } = remoteProjectConfig;
  // flowlint-next-line sketchy-null-string:off
  invariant(clientKey);
  const [encryptedString, salt] = clientKey.split('.');

  if (!encryptedString || !salt) {
    throw new Error('Cannot decrypt client key');
  }

  const restoredClientKey = decryptString(encryptedString, password, salt);

  // flowlint-next-line sketchy-null-string:off
  invariant(certificateAuthorityCertificate);
  // flowlint-next-line sketchy-null-string:off
  invariant(clientCertificate);

  let ca = certificateAuthorityCertificate;
  if (!Array.isArray(ca)) {
    ca = new Buffer(ca);
  }

  return {
    host: remoteProjectConfig.host,
    port: remoteProjectConfig.port,
    family: remoteProjectConfig.family,
    certificateAuthorityCertificate: ca,
    clientCertificate: new Buffer(clientCertificate),
    clientKey: new Buffer(restoredClientKey),
    version: remoteProjectConfig.version,
  };
}

function decryptString(text: string, password: string, salt: string): string {
  const decipher = crypto.createDecipheriv(
    'aes-128-cbc',
    new Buffer(password, 'base64'),
    new Buffer(salt, 'base64'),
  );

  let decryptedString = decipher.update(text, 'base64', 'utf8');
  decryptedString += decipher.final('utf8');

  return decryptedString;
}

function encryptString(
  text: string,
): {password: string, salt: string, encryptedString: string} {
  const password = crypto.randomBytes(16).toString('base64');
  const salt = crypto.randomBytes(16).toString('base64');

  const cipher = crypto.createCipheriv(
    'aes-128-cbc',
    new Buffer(password, 'base64'),
    new Buffer(salt, 'base64'),
  );

  let encryptedString = cipher.update(
    text,
    /* input_encoding */ 'utf8',
    /* output_encoding */ 'base64',
  );
  encryptedString += cipher.final('base64');

  return {
    password,
    salt,
    encryptedString,
  };
}

export const __test__ = {
  decryptString,
  encryptString,
};
