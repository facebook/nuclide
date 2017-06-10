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

import {ConfigCache} from 'nuclide-commons/ConfigCache';
import {runCommand} from 'nuclide-commons/process';
import {getLogger} from 'log4js';

const HACK_LOGGER_CATEGORY = 'nuclide-hack';
export const logger = getLogger(HACK_LOGGER_CATEGORY);

const HACK_CONFIG_FILE_NAME = '.hhconfig';
const PATH_TO_HH_CLIENT = 'hh_client';

// From hack/src/utils/findUtils.ml
export const HACK_FILE_EXTENSIONS: Array<string> = [
  '.php', // normal php file
  '.hh', // Hack extension some open source code is starting to use
  '.phpt', // our php template files
  '.hhi', // interface files only visible to the type checker
  '.xhp', // XHP extensions
];

// Kick this off early, so we don't need to repeat this on every call.
// We don't have a way of changing the path on the dev server after a
// connection is made so this shouldn't change over time.
// Worst case scenario is requiring restarting Nuclide after changing the hh_client path.
const DEFAULT_HACK_COMMAND: Promise<string> = findHackCommand();
let hackCommand = DEFAULT_HACK_COMMAND;

const configCache = new ConfigCache(HACK_CONFIG_FILE_NAME);

/**
* If this returns null, then it is not safe to run hack.
*/
export function findHackConfigDir(localFile: string): Promise<?string> {
  return configCache.getConfigDir(localFile);
}

// Returns the empty string on failure
async function findHackCommand(): Promise<string> {
  try {
    return (await runCommand('which', [PATH_TO_HH_CLIENT]).toPromise()).trim();
  } catch (err) {
    return '';
  }
}

export function setHackCommand(newHackCommand: string): void {
  if (newHackCommand === '') {
    hackCommand = DEFAULT_HACK_COMMAND;
  } else {
    logger.debug(`Using custom hh_client: ${newHackCommand}`);
    hackCommand = Promise.resolve(newHackCommand);
  }
}

export function getHackCommand(): Promise<string> {
  return hackCommand;
}

export async function getHackExecOptions(
  localFile: string,
): Promise<?{hackRoot: string, hackCommand: string}> {
  const [currentHackCommand, hackRoot] = await Promise.all([
    hackCommand,
    findHackConfigDir(localFile),
  ]);
  if (hackRoot && currentHackCommand) {
    return {hackRoot, hackCommand: currentHackCommand};
  } else {
    return null;
  }
}
