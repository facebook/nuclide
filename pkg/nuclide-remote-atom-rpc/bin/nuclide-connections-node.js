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

import nuclideUri from 'nuclide-commons/nuclideUri';
import {runCommand} from 'nuclide-commons/process';
import os from 'os';
import yargs from 'yargs';
import {getCommands} from './CommandClient';
import {
  setupErrorHandling,
  setupLogging,
  EXIT_CODE_CONNECTION_ERROR,
  EXIT_CODE_SUCCESS,
  FailedConnectionError,
  trackError,
  trackSuccess,
} from './errors';

/*
 * CLI for printing information about the Atom clients connected to the Nuclide
 * server running on this machine. By default, it lists the remote root folders
 * in the Atom clients that correspond to this host. The list is written to
 * stdout as JSON.
 */

async function main(argv): Promise<number> {
  setupLogging();
  setupErrorHandling();

  // Connect to the Nuclide server running on this host, if it exists.
  let commands = null;
  try {
    commands = await getCommands(argv, /* rejectIfZeroConnections */ false);
  } catch (error) {
    // Only a FailedConnectionError is expected.
    if (!(error instanceof FailedConnectionError)) {
      await trackError('connections', argv, error);
      return EXIT_CODE_CONNECTION_ERROR;
    }
  }

  let foldersArray;
  if (commands == null) {
    // If commands is null, then there is no Nuclide server running.
    // We should print an empty array without any ceremony in this case.
    foldersArray = [];
  } else {
    const hostname = os.hostname();
    const isAliasForHostname = async function(alias: string): Promise<boolean> {
      if (hostname === alias) {
        return true;
      } else {
        return (await resolveAlias(alias)) === hostname;
      }
    };

    // Note that each ClientConnection represents an Atom window, so
    // the rootFolders across windows may overlap. Add all of them to
    // a Set to de-dupe.
    const projectStates = await commands.getProjectStates();
    const rootFolders = new Set();
    for (const projectState of projectStates) {
      for (const rootFolder of projectState.rootFolders) {
        if (nuclideUri.isRemote(rootFolder)) {
          const alias = nuclideUri.getHostname(rootFolder);
          // eslint-disable-next-line no-await-in-loop
          if (await isAliasForHostname(alias)) {
            const path = nuclideUri.getPath(rootFolder);
            rootFolders.add(path);
          }
        }
      }
    }
    foldersArray = Array.from(rootFolders);
  }

  foldersArray.sort();
  process.stdout.write(JSON.stringify(foldersArray, null, 2));
  process.stdout.write('\n');
  await trackSuccess('connections', argv);
  return EXIT_CODE_SUCCESS;
}

async function resolveAlias(alias: string): Promise<?string> {
  let stdout;
  try {
    stdout = await runCommand('dig', ['+short', 'cname', alias]).toPromise();
  } catch (e) {
    // Defend against the case where `dig` is not installed.
    return null;
  }

  // Strip trailing newline. It is possible there was no output
  // if there was nothing to resolve, e.g.: dig +short cname `hostname`.
  stdout = stdout.trim();
  if (stdout === '') {
    return null;
  }

  // The result likely includes '.' at the end to indicate the
  // result is a fully-qualified domain name. If so, we strip it
  // so it can be compared directly with hostname(1).
  if (stdout.endsWith('.')) {
    stdout = stdout.slice(0, -1);
  }

  return stdout;
}

async function run(): Promise<void> {
  const {argv} = yargs
    .usage('Usage: nuclide-connections')
    .help('h')
    .alias('h', 'help')
    .option('socket', {
      describe: 'Path to Unix domain socket on which to connect.',
      type: 'string',
    });

  const exitCode = await main(argv);
  process.exit(exitCode);
}

run();
