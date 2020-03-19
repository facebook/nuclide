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

import net from 'net';
import os from 'os';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {execFile} from '../common/child_process';
import fs from '../common/fs';

type CertificatePaths = {
  // All of the other paths will be entries in this directory.
  certsDir: string,
  caKey: string,
  caCert: string,
  serverKey: string,
  serverCsr: string,
  serverCert: string,
  clientKey: string,
  clientCsr: string,
  clientCert: string,
};

/**
 * If successful, this will return a set of paths where all of the certificate info was written.
 */
export async function generateCertificates(
  clientCommonName: string,
  serverCommonName: string,
  openSSLConfigPath: string,
  expirationDays: number,
): Promise<CertificatePaths> {
  // Set the process umask to 0077 to ensure that certificates have 0700 permissions.
  // The spawned OpenSSL processes will inherit the umask.
  const oldUmask = process.umask();
  process.umask(0o77);
  try {
    const paths = await generateKeyPairPaths();
    const env = generateEnvironmentForOpenSSLCalls(serverCommonName);
    await generateCA(paths.caKey, paths.caCert, expirationDays, env);
    await Promise.all([
      generateKeyAndCertificate(
        paths.caKey,
        paths.caCert,
        expirationDays,
        paths.serverKey,
        paths.serverCsr,
        paths.serverCert,
        openSSLConfigPath,
        serverCommonName,
        1,
        env,
      ),
      generateKeyAndCertificate(
        paths.caKey,
        paths.caCert,
        expirationDays,
        paths.clientKey,
        paths.clientCsr,
        paths.clientCert,
        openSSLConfigPath,
        clientCommonName,
        2,
        env,
      ),
    ]);
    return paths;
  } finally {
    process.umask(oldUmask);
  }
}

async function generateCA(
  caKeyPath: string,
  caCertPath: string,
  expirationDays: number,
  env: Object,
): Promise<void> {
  const command = 'openssl';
  const options = {env};
  await execFile(command, ['genrsa', '-out', caKeyPath, '1024'], options);
  await execFile(
    command,
    [
      'req',
      '-new',
      '-x509',
      '-days',
      String(expirationDays),
      '-key',
      caKeyPath,
      '-out',
      caCertPath,
      '-batch',
    ],
    options,
  );
}

async function generateKeyAndCertificate(
  caKeyPath: string,
  caCertPath: string,
  expirationDays: number,
  keyFilePath: string,
  csrFilePath: string,
  certFilePath: string,
  openSSLConfigPath: string,
  commonName: string,
  serial: number,
  env: Object,
): Promise<void> {
  const command = 'openssl';
  const options = {env};
  await execFile(command, ['genrsa', '-out', keyFilePath, '1024'], options);
  await execFile(
    command,
    [
      'req',
      '-new',
      '-key',
      keyFilePath,
      '-out',
      csrFilePath,
      '-subj',
      `/CN=${commonName}`,
      '-config',
      openSSLConfigPath,
    ],
    options,
  );
  await execFile(
    command,
    [
      'x509',
      '-req',
      '-days',
      String(expirationDays),
      '-in',
      csrFilePath,
      '-CA',
      caCertPath,
      '-CAkey',
      caKeyPath,
      '-set_serial',
      String(serial),
      '-out',
      certFilePath,
      '-extensions',
      'v3_req',
      '-extfile',
      openSSLConfigPath,
    ],
    options,
  );
}

/**
 * Creates a new temporary directory where all of the certificate data for one instance
 * of the server should be written.
 */
async function generateKeyPairPaths(): Promise<CertificatePaths> {
  const certsDir = await fs.mkdtemp(
    nuclideUri.join(os.tmpdir(), '.big-dig-certs'),
  );
  const pathPrefix = nuclideUri.join(certsDir, 'big-dig');
  return {
    certsDir,
    caKey: `${pathPrefix}.ca.key`,
    caCert: `${pathPrefix}.ca.crt`,
    serverKey: `${pathPrefix}.server.key`,
    serverCsr: `${pathPrefix}.server.csr`,
    serverCert: `${pathPrefix}.server.cert`,
    clientKey: `${pathPrefix}.client.key`,
    clientCsr: `${pathPrefix}.client.csr`,
    clientCert: `${pathPrefix}.client.cert`,
  };
}

function generateEnvironmentForOpenSSLCalls(serverCommonName: string): Object {
  const env = {...process.env};
  if (process.platform === 'darwin') {
    // High Sierra comes with LibreSSL by default, which is not supported.
    // Often, OpenSSL may be installed by Homebrew.
    env.PATH = '/usr/local/opt/openssl/bin:' + env.PATH;
  }
  // Usually, we don't have to make the common name a SAN,
  // but our openssl.cnf requires a value via $OPENSSL_SAN.
  env.OPENSSL_SAN = net.isIP(serverCommonName)
    ? `IP:${serverCommonName}`
    : `DNS.1:${serverCommonName}`;
  return env;
}
