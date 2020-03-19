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

import yargs from 'yargs';
import {getCommands} from './CommandClient';
import {
  explainNuclideIsNeededAndExit,
  setupErrorHandling,
  setupLogging,
  EXIT_CODE_SUCCESS,
  FailedConnectionError,
  trackError,
  trackSuccess,
} from './errors';
import readStdin from 'get-stdin';
import {restrictLength} from '../shared/MessageLength';

/**
 * Command-line tool that sets contents of clipboard on a connected
 * machine running Atom to what it reads from stdin.
 */

async function main(argv): Promise<number> {
  setupLogging();
  setupErrorHandling();

  // Connect to the Nuclide server running on this host, if it exists.
  let commands = null;
  try {
    commands = await getCommands(argv, /* rejectIfZeroConnections */ true);
  } catch (error) {
    await trackError('copy', argv, error);
    if (error instanceof FailedConnectionError) {
      // Note this does not throw: explainNuclideIsNeededAndExit()
      // does not return. However, we use throw to convince Flow
      // that any code after this is unreachable.
      throw explainNuclideIsNeededAndExit();
    } else {
      throw error;
    }
  }

  const input = await readInput();
  if (input.length !== 0) {
    await commands.setClipboardContents(input);
  } else {
    // On macOS, pbcopy blocks on stdin until an EOF. Printing help seems more useful.
    process.stderr.write(yargs.help());
  }

  await trackSuccess('copy', argv._);
  return EXIT_CODE_SUCCESS;
}

async function readInput(): Promise<string> {
  const input: string = await new Promise(resolve => {
    readStdin(resolve);
  });
  return restrictLength(input);
}

async function run(): Promise<void> {
  const {argv} = yargs
    .usage(
      '\nRead standard input, send to clipboard on a connected laptop. ' +
        'Requires an active Nuclide connection. Limited to 100,000 characters.',
    )
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
