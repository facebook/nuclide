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

import type {LauncherScriptParams} from './launchServer';

import {timeoutPromise, TimedOutError} from 'nuclide-commons/promise';
import fs from '../common/fs';
import child_process from 'child_process';
import {getLogger} from 'log4js';
import os from 'os';
import temp from 'temp';
import {generateCertificates} from './certificates';
import invariant from 'assert';

export type CertificateStrategy =
  | {
      type: 'reuse',
      paths: {serverKey: string, serverCert: string, caCert: string},
    }
  | {
      type: 'generate',
      clientCommonName: string,
      serverCommonName: string,
      openSSLConfigPath: string,
    }
  | {
      type: 'rootcanal',
    };

export type StartServerParams = {
  certificateStrategy: CertificateStrategy,
  ports: string,
  timeout: number,
  expirationDays: number,
  exclusive: ?string,
  jsonOutputFile: string,
  absolutePathToServerMain: string,
  useRootCanalCerts: boolean,
  serverParams: mixed,
};

export async function startServer({
  certificateStrategy,
  ports,
  timeout,
  expirationDays,
  exclusive,
  jsonOutputFile,
  absolutePathToServerMain,
  useRootCanalCerts,
  serverParams,
}: StartServerParams): Promise<void> {
  const logger = getLogger();
  logger.info('in startServer()');

  let paths;
  let certificateGeneratorOutput = {};
  switch (certificateStrategy.type) {
    case 'generate':
      const {
        clientCommonName,
        serverCommonName,
        openSSLConfigPath,
      } = certificateStrategy;
      paths = await generateCertificates(
        clientCommonName,
        serverCommonName,
        openSSLConfigPath,
        expirationDays,
      );
      logger.info('generateCertificates() succeeded!');
      certificateGeneratorOutput = {
        hostname: serverCommonName,
        cert: await fs.readFileAsString(paths.clientCert),
        key: await fs.readFileAsString(paths.clientKey),
      };
      break;
    case 'rootcanal':
      logger.info('using rootcanal certificates');
      const env = getOriginalEnvironment(process.env);
      const hostname = env.HOSTNAME;
      invariant(hostname != null);
      paths = {
        serverCert: `/etc/pki/tls/certs/${hostname}.crt`,
        serverKey: `/etc/pki/tls/certs/${hostname}.key`,
        caCert: '/var/facebook/rootcanal/corp_root.pem',
      };
      break;
    case 'reuse':
      logger.info('reusing existing certificates');
      paths = certificateStrategy.paths;

      break;
    default:
      (certificateStrategy.type: empty);
      throw new Error('invalid certificate strategy');
  }

  const [key, cert, ca] = await Promise.all([
    fs.readFileAsBuffer(paths.serverKey),
    fs.readFileAsBuffer(paths.serverCert),
    fs.readFileAsBuffer(paths.caCert),
  ]);

  const params: LauncherScriptParams = {
    key: key.toString(),
    cert: cert.toString(),
    ca: ca.toString(),
    ports,
    expirationDays,
    exclusive,
    absolutePathToServerMain,
    useRootCanalCerts,
    serverParams,
  };

  // Redirect child stderr to a file so that we can read it.
  // (If we just pipe it, there's no safe way of disconnecting it after.)
  temp.track();
  const stderrLog = temp.openSync('big-dig-stderr');

  const launcherScript = require.resolve('./launchServer-entry.js');
  logger.info(`About to spawn ${launcherScript} to launch Big Dig server.`);
  const child = child_process.spawn(
    process.execPath,
    [
      // Increase stack trace limit for better debug logs.
      // For reference, Atom/Electron does not have a stack trace limit.
      '--stack-trace-limit=50',
      // Increase the maximum heap size if we have enough memory.
      ...(os.totalmem() > 8 * 1024 * 1024 * 1024
        ? ['--max-old-space-size=4096']
        : []),
      launcherScript,
    ],
    {
      detached: true,
      stdio: ['ignore', 'ignore', stderrLog.fd, 'ipc'],
    },
  );
  logger.info(`spawn called for ${launcherScript}`);
  // Send launch parameters over IPC to avoid making them visible in `ps`.
  child.send(params);

  const childPort = await timeoutPromise(
    new Promise((resolve, reject) => {
      const onMessage = ({port: result}) => {
        resolve(result);
        child.removeAllListeners();
      };
      child.on('message', onMessage);
      child.on('error', reject);
      child.on('exit', async code => {
        const stderr = await fs
          .readFileAsString(stderrLog.path)
          .catch(() => '');
        reject(
          Error(`Child exited early with code ${code}.\nstderr: ${stderr}`),
        );
      });
    }),
    timeout,
  ).catch(err => {
    // Make sure we clean up hung children.
    if (err instanceof TimedOutError) {
      child.kill('SIGKILL');
    }
    return Promise.reject(err);
  });

  const {version} = require('../../package.json');
  const json = JSON.stringify(
    // These properties are the ones currently written by nuclide-server.
    {
      ...certificateGeneratorOutput,
      pid: child.pid,
      version,
      port: childPort,
      ca: ca.toString(),
      ca_path: paths.caCert,
      server_cert_path: paths.serverCert,
      server_key_path: paths.serverKey,
      protocol_version: 2,
      success: true,
    },
  );
  await fs.writeFile(jsonOutputFile, json, {mode: 0o600});
  logger.info(`Server config written to ${jsonOutputFile}.`);
  child.unref();
}

type DevserverEnvironment = {
  HOSTNAME?: string,
};

function getOriginalEnvironment(nuclideEnvironment): DevserverEnvironment {
  const {NUCLIDE_ORIGINAL_ENV} = nuclideEnvironment;
  let result = {};
  if (NUCLIDE_ORIGINAL_ENV != null && NUCLIDE_ORIGINAL_ENV.trim() !== '') {
    result = new Buffer(NUCLIDE_ORIGINAL_ENV, 'base64')
      .toString()
      .split('\0')
      .reduce((env, curr) => {
        const keyAndValue = curr.split('=');
        env[keyAndValue[0]] = keyAndValue[1];
        return env;
      }, {});
  }
  return result;
}
