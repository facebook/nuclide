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

import fs from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getLogger} from 'log4js';
import {asyncFilter, asyncFind} from 'nuclide-commons/promise';
import os from 'os';

const logger = getLogger('nuclide-remote-atom-rpc');

export const RPC_PROTOCOL = 'atom_rpc_protocol';

const NUCLIDE_DIR = '.nuclide';
const NUCLIDE_SERVER_INFO_DIR = 'command-server';
const SOCKET_FILE = 'commands.socket';

function getConfigDirectory(directory: NuclideUri): NuclideUri {
  return nuclideUri.join(directory, NUCLIDE_DIR, NUCLIDE_SERVER_INFO_DIR);
}

/**
 * The local command server stores its state in files in a directory. The structure of the config
 * directory is as follows:
 * - It contains a list of subdirectories where the name of each subdirectory corresponds to the
 *   port of the nuclide-server whose data it contains.
 * - Each subdirectory contains a serverInfo.json file, which contains a ServerInfo about the
 *   instance of nuclide-server.
 *
 * Code in this file is used by the NuclideServer process as well as the atom
 * command line process on the server.
 */
async function createConfigDirectory(): Promise<NuclideUri> {
  // Try some candidate directories. We exclude the directory if it is on NFS
  // because nuclide-server is local, so it should only write out its state to
  // a local directory.
  const result = await asyncFind(getCandidateDirectories(), async directory => {
    if (await fs.isNonNfsDirectory(directory)) {
      const configDirPath = getConfigDirectory(directory);
      // When starting up a new server, we remove any connection configs leftover
      // from previous runs.
      await fs.rimraf(configDirPath);
      if (await fs.exists(configDirPath)) {
        throw new Error(
          'createConfigDirectory: Failed to remove' + configDirPath,
        );
      }
      await fs.mkdirp(configDirPath);
      return configDirPath;
    } else {
      return null;
    }
  });
  if (result == null) {
    throw new Error('Could not create a config directory');
  }
  return result;
}

export async function getValidPathToSocket(): Promise<NuclideUri> {
  const configDir = await createConfigDirectory();
  return nuclideUri.join(configDir, SOCKET_FILE);
}

export async function getServerSocket(): Promise<?string> {
  const configDirectory = await findPathToConfigDirectory();
  if (configDirectory == null) {
    return null;
  }

  const filesInConfig = (await fs.readdir(configDirectory)).map(entry =>
    nuclideUri.join(configDirectory, entry),
  );
  const socketPaths = await asyncFilter(filesInConfig, async file =>
    (await fs.stat(file)).isSocket(),
  );
  // For now, just return the first ServerInfo found.
  // Currently there can be only one ServerInfo at a time.
  // In the future, we may use the serverMetadata to determine which server
  // to use.
  if (socketPaths.length > 0) {
    const socketPath = socketPaths[0];
    logger.debug(`Found Nuclide Unix domain socket at ${socketPath}`);
    return socketPath;
  } else {
    return null;
  }
}

function findPathToConfigDirectory(): Promise<?string> {
  return asyncFind(getCandidateDirectories(), async directory => {
    const configDir = getConfigDirectory(directory);
    return (await fs.exists(configDir)) ? configDir : null;
  });
}

function getCandidateDirectories(): Array<string> {
  const {homedir} = os.userInfo();
  return [
    // Try the ~/local directory (if it exists) to avoid directly polluting homedirs.
    nuclideUri.resolve(nuclideUri.join(homedir, 'local')),
    // Then try the OS temporary directory...
    os.tmpdir(),
    // And fall back to the home directory as a last resort.
    homedir,
  ];
}
