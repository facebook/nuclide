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

import type {CommandInfo} from './types';

import fsPromise from 'nuclide-commons/fsPromise';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {getBuckProjectRoot} from '../../nuclide-buck-base';
import ini from 'ini';
import nuclideUri from 'nuclide-commons/nuclideUri';

type PartialCommandInfo = {
  command: string,
  args: Array<string>,
};

/**
 * Get the command that will run the packager server based on the current workspace.
 * TODO: We need to have a solid concept of an "active project" that's consistent across Nuclide
 *       (i.e. where we should look for commands like this) and use that here. The current behavior
 *       of everything having its own algorithm is bad.
 */
export async function getCommandInfo(
  projectRootPath: ?string,
): Promise<?CommandInfo> {
  if (projectRootPath == null || nuclideUri.isRemote(projectRootPath)) {
    return null;
  }

  return (
    (await getCommandFromBuck(projectRootPath)) ||
    getCommandFromNodePackage(projectRootPath)
  );
}

async function getCommandFromNodePackage(dir: string): Promise<?CommandInfo> {
  return (
    (await getCommandFromNodeModules(dir)) || getCommandFromReactNative(dir)
  );
}

/**
 * Look in the nearest node_modules directory for react-native and extract the packager script if
 * it's found.
 */
async function getCommandFromNodeModules(dir: string): Promise<?CommandInfo> {
  const nodeModulesParent = await fsPromise.findNearestFile(
    'node_modules',
    dir,
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
async function getCommandFromReactNative(dir: string): Promise<?CommandInfo> {
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

async function getCommandFromBuck(dir: string): Promise<?CommandInfo> {
  const projectRoot = await getBuckProjectRoot(dir);
  if (projectRoot == null) {
    return null;
  }

  // TODO(matthewwithanm): Move this to BuckUtils?
  const filePath = nuclideUri.join(projectRoot, '.buckconfig');
  const content = await fsPromise.readFile(filePath, 'utf8');
  const parsed = ini.parse(`scope = global\n${content}`);
  const section = parsed['react-native'];
  if (section == null || section.server == null) {
    return null;
  }
  return {
    cwd: projectRoot,
    command: section.server,
  };
}

async function getCommandForCli(
  pathToReactNative: string,
): Promise<?PartialCommandInfo> {
  const cliPath = nuclideUri.join(pathToReactNative, 'local-cli', 'cli.js');
  const cliExists = await fsPromise.exists(cliPath);
  if (!cliExists) {
    return null;
  }
  return {
    command: ((featureConfig.get(
      'nuclide-react-native.pathToNode',
    ): any): string),
    args: [cliPath, 'start'],
  };
}
