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

import invariant from 'assert';
import os from 'os';

import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {shellParse} from 'nuclide-commons/string';

import type {Command} from './rpc-types';

const CONFIG_BASENAME = '.nuclide-terminal.json';

export type Config = {
  command?: Command,
};

export async function readConfig(): Promise<?Config> {
  let configContents = (null: ?string);
  try {
    const configFile = nuclideUri.expandHomeDir(`~/${CONFIG_BASENAME}`);
    configContents = await fsPromise.readFile(configFile, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      // If the user has no config file, that is still success, just with empty result.
      return Promise.resolve(null);
    } else {
      return Promise.reject(
        new Error(`code='${error.code}', error='${error}'`),
      );
    }
  }

  try {
    return parseConfig(configContents);
  } catch (error) {
    return Promise.reject(error);
  }
}

export function parseConfig(configContents: string): Config {
  function throwError(message: string): Error {
    throw new Error(
      `(${os.hostname()}) error parsing ~/${CONFIG_BASENAME}:\n` +
        `  ${message}.\n` +
        'Contents:\n' +
        configContents,
    );
  }

  let rawConfig = null;
  try {
    rawConfig = JSON.parse(configContents);
  } catch (e) {
    throwError(e);
  }

  if (typeof rawConfig !== 'object') {
    throw throwError('Expected top-level to be an object.');
  }
  invariant(rawConfig != null);

  let argv = null;
  const command = rawConfig.command;
  if (typeof command === 'string') {
    argv = shellParse(command);
  } else if (Array.isArray(command)) {
    for (const arg of command) {
      if (typeof arg !== 'string') {
        throwError(`'args' must be strings, got ${arg}`);
      }
    }
    argv = command;
  } else {
    throw throwError('"command" must be a string or string array');
  }

  return {
    command: {
      file: argv[0],
      args: argv.slice(1),
    },
  };
}
