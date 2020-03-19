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

/**
 * Command-line tool that allows you to paste contents of clipboard from a connected
 * machine running Atom.
 */

async function main(argv): Promise<number> {
  setupLogging();
  setupErrorHandling();

  // Connect to the Nuclide server running on this host, if it exists.
  let commands = null;
  try {
    commands = await getCommands(argv, /* rejectIfZeroConnections */ true);
  } catch (error) {
    await trackError('paste', argv, error);
    if (error instanceof FailedConnectionError) {
      // Note this does not throw: explainNuclideIsNeededAndExit()
      // does not return. However, we use throw to convince Flow
      // that any code after this is unreachable.
      throw explainNuclideIsNeededAndExit();
    } else {
      throw error;
    }
  }

  let contents = await commands.getClipboardContents();
  if (!contents.endsWith('\n')) {
    contents += '\n';
  }
  process.stdout.write(contents);

  await trackSuccess('paste', argv);
  return EXIT_CODE_SUCCESS;
}

async function run(): Promise<void> {
  const {argv} = yargs
    .usage(
      '\nPrint clipboard contents from a connected laptop to standard output. ' +
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
