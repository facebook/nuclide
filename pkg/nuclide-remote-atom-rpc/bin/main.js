'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {NuclideUri} from '../../commons-node/nuclideUri';

import {
  openFile,
  openRemoteFile,
  addProject,
} from './CommandClient';
import fsPromise from '../../commons-node/fsPromise';
import nuclideUri from '../../commons-node/nuclideUri';
import {
  setupErrorHandling,
  setupLogging,
  reportErrorAndExit,
  EXIT_CODE_SUCCESS,
  EXIT_CODE_APPLICATION_ERROR,
} from './errors';
import {
  getLogger,
} from '../../nuclide-logging';
import yargs from 'yargs';

const logger = getLogger();

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
  await setupLogging();
  setupErrorHandling();

  logger.debug(`nuclide-remote-atom with arguments: ${argv._}`);

  // TODO(t10180337): Consider a batch API for openFile().
  for (const arg of argv._) {
    const {filePath, line, column} = parseLocationParameter(arg);
    // eslint-disable-next-line babel/no-await-in-loop
    const realpath = await getRealPath(filePath);
    // eslint-disable-next-line babel/no-await-in-loop
    const isDirectory = await getIsDirectory(realpath);
    try {
      if (nuclideUri.isRemote(realpath)) {
        const result = openRemoteFile(realpath, line, column, Boolean(argv.wait));
        if (argv.wait) {
          // eslint-disable-next-line babel/no-await-in-loop
          await result.toPromise();
        } else {
          // eslint-disable-next-line babel/no-await-in-loop
          await result.take(1).toPromise();
        }
      } else if (isDirectory) {
        // file/line/wait are ignored on directories
        // eslint-disable-next-line babel/no-await-in-loop
        await addProject(realpath);
      } else {
        const result = openFile(realpath, line, column, Boolean(argv.wait));
        if (argv.wait) {
          // eslint-disable-next-line babel/no-await-in-loop
          await result.toPromise();
        } else {
          // eslint-disable-next-line babel/no-await-in-loop
          await result.take(1).toPromise();
        }
      }
    } catch (e) {
      reportErrorAndExit(e, EXIT_CODE_APPLICATION_ERROR);
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
      describe: 'Ignored, as --add as always implied. ' +
        'Included for compatibility with atom CLI.',
      type: 'boolean',
    })
    .option('w', {
      alias: 'wait',
      describe: 'Wait for the opened file to be closed in Atom before exiting',
      type: 'boolean',
    });
  const exitCode = await main(argv);
  process.exit(exitCode);
}

run();
