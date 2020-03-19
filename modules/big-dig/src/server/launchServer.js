/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import invariant from 'assert';
import fs from 'fs';
import log4js from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {psTree} from 'nuclide-commons/process';
import os from 'os';
import fsPromise from '../common/fs';
import {BigDigServer} from './BigDigServer';

export type LauncherScriptParams = {|
  key: string,
  cert: string,
  ca: string,
  ports: string,
  expirationDays: number,
  exclusive: ?string,
  absolutePathToServerMain: string,
  useRootCanalCerts: boolean,
  serverParams: mixed,
|};

function main() {
  // launchServer should only be spawned from ./main.js.
  if (process.send == null) {
    // eslint-disable-next-line no-console
    console.error(
      'Error: launchServer should only be spawned via parseArgsAndRunMain.',
    );
    process.exit(1);
  }

  process.on('message', params => {
    handleLaunchParams(params).catch(error => {
      log4js.getLogger().fatal('launchServer failed:', error);
      log4js.shutdown(() => process.exit(1));
    });
  });
}

async function handleLaunchParams(params: LauncherScriptParams) {
  if (params.exclusive != null) {
    await enforceExclusive(params.exclusive);
  }

  const server: BigDigServer = await BigDigServer.createServer({
    ports: params.ports,
    webServer: {
      key: params.key,
      cert: params.cert,
      ca: params.ca,
      rejectUnauthorized: true,
      requestCert: true,
    },
    useRootCanalCerts: params.useRootCanalCerts,
    absolutePathToServerMain: params.absolutePathToServerMain,
    serverParams: params.serverParams,
  });

  const port = server.getPort();

  invariant(process.send != null);
  process.send({port}, () => {
    invariant(process.disconnect);
    process.disconnect();
  });

  // Exit once the certificates expire, as no clients will be able to connect at this point.
  setTimeout(() => {
    log4js
      .getLogger()
      .info(
        `Certificates expired after ${
          params.expirationDays
        } days, shutting down.`,
      );
    process.exit(2);
  }, params.expirationDays * 24 * 60 * 60 * 1000);
}

// When an 'exclusive' parameter is provided, we'll ensure that only one server
// with a given "exclusive" tag is alive at any given time (per user).
// We do this by storing a .bigdig.exclusive.pid file in sharedCertsDir:
// if the file already exists, we'll try to kill the PID in that file.
async function enforceExclusive(exclusive: string): Promise<void> {
  const bigDigPath = nuclideUri.join(os.homedir(), '.big-dig');
  try {
    await fsPromise.mkdir(bigDigPath);
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
  const pidFile = nuclideUri.join(bigDigPath, `.big-dig.${exclusive}.pid`);

  while (true) {
    try {
      const c = fs.constants;
      // O_CREAT / O_EXCL atomically creates the PID file.
      // Ideally we'd use fcntl/flock to hold onto the PID file until exit,
      // but sadly there's no easy flock API in Node.
      const handle = fs.openSync(
        pidFile,
        // eslint-disable-next-line no-bitwise
        c.O_WRONLY | c.O_CREAT | c.O_EXCL,
        // Readable only for the current user.
        0o600,
      );
      log4js.getLogger().info(`Writing pid=${process.pid} to ${pidFile}`);
      // $FlowFixMe: writeFileSync takes handles too.
      fs.writeFileSync(handle, process.pid);
      fs.closeSync(handle);
      break;
    } catch (error) {
      if (error.code === 'EEXIST') {
        // Note: the read, kill, and unlink steps could all throw.
        // However, an exception at any of those steps probably indicates a race,
        // in which case we should probably bail out anyway.
        const pidContents = fs.readFileSync(pidFile, 'utf8');
        const pid = parseInt(pidContents, 10);
        if (pid > 0) {
          log4js.getLogger().info(`Killing existing server with pid=${pid}`);
          // Node doesn't have any flock() style primitives, so we can't be certain
          // that this pid still corresponds to the process.
          // As a quick sanity check, we'll inspect the pstree to see that it's consistent.
          // eslint-disable-next-line no-await-in-loop
          const processTree = await psTree();
          const processInfo = processTree.find(proc => proc.pid === pid);
          if (
            processInfo != null &&
            processInfo.commandWithArgs.includes('launchServer')
          ) {
            process.kill(pid);
          }
        }
        fs.unlinkSync(pidFile);
      } else {
        throw error;
      }
    }
  }

  // Attempt to clean up the pid file on graceful exits.
  process.on('exit', () => {
    try {
      fs.unlinkSync(pidFile);
    } catch (err) {
      // It's fine if the file no longer exists.
    }
  });
}

log4js.configure({
  appenders: [
    {
      type: 'file',
      filename: nuclideUri.join(os.tmpdir(), 'big-dig.log'),
    },
    {
      type: 'stderr',
    },
  ],
});

process.on('unhandledRejection', error => {
  log4js.getLogger().error('Unhandled rejection:', error);
});

process.on('uncaughtException', error => {
  log4js.getLogger().fatal('Uncaught exception:', error);
  log4js.shutdown(() => process.abort());
});

main();
