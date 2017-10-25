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

import child_process from 'child_process';
import fs from '../common/fs';
import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getLogger} from 'log4js';
import {generateCertificates} from './certificates';

export async function generateCertificatesAndStartServer(
  clientCommonName: string,
  serverCommonName: string,
  openSSLConfigPath: string,
  port: number,
  expirationDays: number,
  jsonOutputFile: string,
  absolutePathToServerMain: string,
  serverParams: mixed,
): Promise<void> {
  const logger = getLogger();
  logger.info('in generateCertificatesAndStartServer()');

  // flowlint-next-line sketchy-null-string:off
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  // flowlint-next-line sketchy-null-string:off
  invariant(homeDir);

  const sharedCertsDir = nuclideUri.join(homeDir, '.certs');
  try {
    await fs.mkdir(sharedCertsDir);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  // HACK: kill existing servers on the given port.
  try {
    child_process.execFileSync('pkill', [
      '-f',
      `launchServer-entry.js.*"port":${port}`,
    ]);
  } catch (e) {}

  const paths = await generateCertificates(
    clientCommonName,
    serverCommonName,
    openSSLConfigPath,
    sharedCertsDir,
    expirationDays,
  );
  logger.info('generateCertificates() succeeded!');

  const [key, cert, ca] = await Promise.all([
    fs.readFileAsBuffer(paths.serverKey),
    fs.readFileAsBuffer(paths.serverCert),
    fs.readFileAsBuffer(paths.caCert),
  ]);
  const params = {
    key: key.toString(),
    cert: cert.toString(),
    ca: ca.toString(),
    port,
    launcher: absolutePathToServerMain,
    serverParams,
  };

  const launcherScript = require.resolve('./launchServer-entry.js');
  logger.info(`About to spawn ${launcherScript} to launch Big Dig server.`);
  const child = child_process.spawn(
    process.execPath,
    [launcherScript, JSON.stringify(params)],
    {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    },
  );
  logger.info(`spawn called for ${launcherScript}`);

  const childPort = await new Promise((resolve, reject) => {
    const onMessage = ({port: result}) => {
      resolve(result);
      child.removeAllListeners();
    };
    child.on('message', onMessage);
    child.on('error', reject);
    child.on('exit', code => {
      logger.info(`${launcherScript} exited with code ${code}`);
      reject(Error(`child exited early with code ${code}`));
    });
  });

  const {version} = require('../../package.json');
  const json = JSON.stringify(
    // These properties are the ones currently written by nuclide-server.
    {
      pid: process.pid,
      version,
      hostname: serverCommonName,
      port: childPort,
      ca: ca.toString(),
      cert: await fs.readFileAsString(paths.clientCert),
      key: await fs.readFileAsString(paths.clientKey),
      success: true,
    },
  );
  await fs.writeFile(jsonOutputFile, json, {mode: 0o600});
  logger.info(`Server config written to ${jsonOutputFile}.`);
  child.unref();
}
