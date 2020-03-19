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
import type {MetroStartCommand} from './types';

import {
  getBuckConfig,
  getRootForPath as getBuckRootForPath,
} from '../../nuclide-buck-rpc';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';

type CommandWithoutProjectRoot = {
  command: string,
  args: Array<string>,
};

export async function getStartCommandFromNodePackage(
  projectRoot: NuclideUri,
): Promise<?MetroStartCommand> {
  return (
    (await getStartCommandFromNodeModules(projectRoot)) ||
    getStartCommandFromReactNative(projectRoot)
  );
}

export async function getStartCommandFromBuck(
  projectRoot: NuclideUri,
): Promise<?MetroStartCommand> {
  const buckProjectRoot = await getBuckRootForPath(projectRoot);
  if (buckProjectRoot == null) {
    return null;
  }
  const serverCommand = await getBuckConfig(
    buckProjectRoot,
    'react-native',
    'server',
  );
  if (serverCommand == null) {
    return null;
  }
  return {
    cwd: buckProjectRoot,
    args: ['--disable-global-hotkey'],
    command: serverCommand,
  };
}

/**
 * Look in the nearest node_modules directory for react-native and extract the packager script if
 * it's found.
 */
async function getStartCommandFromNodeModules(
  projectRoot: NuclideUri,
): Promise<?MetroStartCommand> {
  const nodeModulesParent = await fsPromise.findNearestFile(
    'node_modules',
    projectRoot,
  );
  if (nodeModulesParent == null) {
    return null;
  }

  const command = await getCommandForCli(
    nuclideUri.join(nodeModulesParent, 'node_modules', 'react-native'),
  );

  return command == null
    ? null
    : {
        ...command,
        cwd: nodeModulesParent,
      };
}

/**
 * See if this is React Native itself and, if so, return the command to run the packager. This is
 * special cased so that the bundled examples work out of the box.
 */
async function getStartCommandFromReactNative(
  dir: NuclideUri,
): Promise<?MetroStartCommand> {
  const projectRoot = await fsPromise.findNearestFile('package.json', dir);
  if (projectRoot == null) {
    return null;
  }
  const filePath = nuclideUri.join(projectRoot, 'package.json');
  const content = await fsPromise.readFile(filePath, 'utf8');
  const parsed = JSON.parse(content);
  const isReactNative = parsed.name === 'react-native';

  if (!isReactNative) {
    return null;
  }

  const command = await getCommandForCli(projectRoot);

  return command == null
    ? null
    : {
        ...command,
        cwd: projectRoot,
      };
}

async function getCommandForCli(
  pathToReactNative: NuclideUri,
): Promise<?CommandWithoutProjectRoot> {
  const cliPath = nuclideUri.join(pathToReactNative, 'local-cli', 'cli.js');
  const cliExists = await fsPromise.exists(cliPath);
  if (!cliExists) {
    return null;
  }
  return {
    command: 'node',
    args: [cliPath, 'start'],
  };
}
