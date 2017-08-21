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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import {getCommands, startCommands} from './CommandClient';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {
  setupErrorHandling,
  setupLogging,
  reportErrorAndExit,
  EXIT_CODE_SUCCESS,
  EXIT_CODE_APPLICATION_ERROR,
  EXIT_CODE_INVALID_ARGUMENTS,
} from './errors';
import {getLogger} from 'log4js';
import yargs from 'yargs';

const logger = getLogger('nuclide-remote-atom-rpc');

type FileLocation = {
  filePath: string,
  line: number,
  column: number,
};

const LocationSuffixRegExp = /(:\d+)(:\d+)?$/;

// This code is coped from Atom: src/main-process/atom-application.coffee
function parseLocationParameter(value: string): FileLocation {
  let filePath: string = value.replace(/[:\s]+$/, '');
  const match = filePath.match(LocationSuffixRegExp);

  let line: number = 0;
  let column: number = 0;
  if (match) {
    filePath = filePath.slice(0, -match[0].length);
    if (match[1]) {
      line = Math.max(0, parseInt(match[1].slice(1), 10) - 1);
    }
    if (match[2]) {
      column = Math.max(0, parseInt(match[2].slice(1), 10) - 1);
    }
  }
  return {
    filePath,
    line,
    column,
  };
}

async function getRealPath(filePath: NuclideUri): Promise<NuclideUri> {
  if (nuclideUri.isRemote(filePath)) {
    return filePath;
  }
  return nuclideUri.resolve(filePath);
}

async function getIsDirectory(filePath: NuclideUri): Promise<boolean> {
  try {
    if (nuclideUri.isRemote(filePath)) {
      return false;
    } else {
      const stats = await fsPromise.stat(filePath);
      return stats.isDirectory();
    }
  } catch (e) {
    return false;
  }
}

async function main(argv): Promise<number> {
  setupLogging();
  setupErrorHandling();

  logger.debug(`nuclide-remote-atom with arguments: ${argv._}`);

  // TODO(t10180337): Consider a batch API for openFile().
  if (argv._ != null && argv._.length > 0) {
    const commands =
      argv.port != null
        ? await startCommands(argv.port, argv.family)
        : await getCommands();

    for (const arg of argv._) {
      const {filePath, line, column} = parseLocationParameter(arg);
      // eslint-disable-next-line no-await-in-loop
      const realpath = await getRealPath(filePath);
      // eslint-disable-next-line no-await-in-loop
      const isDirectory = await getIsDirectory(realpath);
      try {
        if (nuclideUri.isRemote(realpath)) {
          const result = commands
            .openRemoteFile(realpath, line, column, Boolean(argv.wait))
            .refCount();
          if (argv.wait) {
            // eslint-disable-next-line no-await-in-loop
            await result.toPromise();
          } else {
            // eslint-disable-next-line no-await-in-loop
            await result.take(1).toPromise();
          }
        } else if (isDirectory) {
          // file/line/wait are ignored on directories
          // eslint-disable-next-line no-await-in-loop
          await commands.addProject(realpath);
        } else {
          const result = commands
            .openFile(realpath, line, column, Boolean(argv.wait))
            .refCount();
          if (argv.wait) {
            // eslint-disable-next-line no-await-in-loop
            await result.toPromise();
          } else {
            // eslint-disable-next-line no-await-in-loop
            await result.take(1).toPromise();
          }
        }
      } catch (e) {
        reportErrorAndExit(e, EXIT_CODE_APPLICATION_ERROR);
      }
    }
  }
  return EXIT_CODE_SUCCESS;
}

async function run() {
  const {argv} = yargs
    .usage('Usage: atom <file>')
    .help('h')
    .alias('h', 'help')
    .demand(1, 'At least one file name is required.')
    .option('a', {
      alias: 'add',
      describe:
        'Ignored, as --add as always implied. ' +
        'Included for compatibility with atom CLI.',
      type: 'boolean',
    })
    .option('w', {
      alias: 'wait',
      describe: 'Wait for the opened file to be closed in Atom before exiting',
      type: 'boolean',
    })
    .option('p', {
      alias: 'port',
      describe: 'Port for connecting to nuclide',
      type: 'number',
    })
    .option('f', {
      alias: 'family',
      describe:
        'Address family for connecting to nuclide. Either "IPv4" or "IPv6".',
      type: 'string',
    });
  if (argv.port == null !== (argv.family == null)) {
    process.stderr.write(
      'Invalid options. Both port and family must be specified.\n',
    );
    process.exit(EXIT_CODE_INVALID_ARGUMENTS);
  }
  const exitCode = await main(argv);
  process.exit(exitCode);
}

run();
