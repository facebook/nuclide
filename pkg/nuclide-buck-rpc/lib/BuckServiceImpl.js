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
import type {BaseBuckBuildOptions} from './types';
import type {ObserveProcessOptions} from 'nuclide-commons/process';

import {runCommand} from 'nuclide-commons/process';
import {PromisePool} from '../../commons-node/promise-executors';
import {getOriginalEnvironment} from 'nuclide-commons/process';
import * as os from 'os';
import fsPromise from 'nuclide-commons/fsPromise';
import {shellQuote} from 'nuclide-commons/string';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-buck-rpc');

// Tag these Buck calls as coming from Nuclide for analytics purposes.
const CLIENT_ID_ARGS = ['--config', 'client.id=nuclide'];

type FullBuckBuildOptions = {
  baseOptions: BaseBuckBuildOptions,
  pathToBuildReport?: string,
  buildTargets: Array<string>,
};

type BuckCommandAndOptions = {
  pathToBuck: string,
  buckCommandOptions: ObserveProcessOptions,
};

/**
 * As defined in com.facebook.buck.cli.Command, some of Buck's subcommands are
 * read-only. The read-only commands can be executed in parallel, but the rest
 * must be executed serially.
 *
 * Still, we try to make sure we don't slow down the user's computer.
 *
 * TODO(hansonw): Buck seems to have some race conditions that prevent us
 * from running things in parallel :(
 */
const MAX_CONCURRENT_READ_ONLY = 1; // Math.max(1, os.cpus().length - 1);
const pools = new Map();

export function getPool(path: string, readOnly: boolean): PromisePool {
  const key = (readOnly ? 'ro:' : '') + path;
  let pool = pools.get(key);
  if (pool != null) {
    return pool;
  }
  pool = new PromisePool(readOnly ? MAX_CONCURRENT_READ_ONLY : 1);
  pools.set(key, pool);
  return pool;
}

/**
 * @return The path to buck and set of options to be used to run a `buck` command.
 */
export async function _getBuckCommandAndOptions(
  rootPath: string,
  commandOptions?: ObserveProcessOptions = {},
): Promise<BuckCommandAndOptions> {
  // $UPFixMe: This should use nuclide-features-config
  let pathToBuck =
    (global.atom &&
      global.atom.config.get('nuclide.nuclide-buck.pathToBuck')) ||
    'buck';
  if (pathToBuck === 'buck' && os.platform() === 'win32') {
    pathToBuck = 'buck.bat';
  }
  const buckCommandOptions = {
    cwd: rootPath,
    // Buck restarts itself if the environment changes, so try to preserve
    // the original environment that Nuclide was started in.
    env: await getOriginalEnvironment(),
    ...commandOptions,
  };
  return {pathToBuck, buckCommandOptions};
}

/**
 * @param options An object describing the desired buck build operation.
 * @return An array of strings that can be passed as `args` to spawn a
 *   process to run the `buck` command.
 */
export function _translateOptionsToBuckBuildArgs(
  options: FullBuckBuildOptions,
): Array<string> {
  const {baseOptions, pathToBuildReport, buildTargets} = options;
  const {
    install: doInstall,
    run,
    simulator,
    test,
    debug,
    extraArguments,
  } = baseOptions;

  let args = [test ? 'test' : doInstall ? 'install' : run ? 'run' : 'build'];
  args = args.concat(buildTargets, CLIENT_ID_ARGS);

  if (!run) {
    args.push('--keep-going');
  }
  // flowlint-next-line sketchy-null-string:off
  if (pathToBuildReport) {
    args = args.concat(['--build-report', pathToBuildReport]);
  }
  if (doInstall) {
    // flowlint-next-line sketchy-null-string:off
    if (simulator) {
      args.push('--udid');
      args.push(simulator);
    }

    if (run) {
      args.push('--run');
      if (debug) {
        args.push('--wait-for-debugger');
      }
    }
  } else if (test) {
    if (debug) {
      args.push('--debug');
    }
  }
  if (extraArguments != null) {
    args = args.concat(extraArguments);
  }
  return args;
}

export async function _build(
  rootPath: NuclideUri,
  buildTargets: Array<string>,
  options: BaseBuckBuildOptions,
): Promise<any> {
  const report = await fsPromise.tempfile({suffix: '.json'});
  const args = _translateOptionsToBuckBuildArgs({
    baseOptions: {...options},
    pathToBuildReport: report,
    buildTargets,
  });

  try {
    await runBuckCommandFromProjectRoot(
      rootPath,
      args,
      options.commandOptions,
      false, // Do not add the client ID, since we already do it in the build args.
      true, // Build commands are blocking.
    );
  } catch (e) {
    // The build failed. However, because --keep-going was specified, the
    // build report should have still been written unless any of the target
    // args were invalid. We check the contents of the report file to be sure.
    const stat = await fsPromise.stat(report).catch(() => null);
    if (stat == null || stat.size === 0) {
      throw e;
    }
  }

  try {
    const json: string = await fsPromise.readFile(report, {encoding: 'UTF-8'});
    try {
      return JSON.parse(json);
    } catch (e) {
      throw Error(`Failed to parse:\n${json}`);
    }
  } finally {
    fsPromise.unlink(report);
  }
}

export function build(
  rootPath: NuclideUri,
  buildTargets: Array<string>,
  options?: BaseBuckBuildOptions,
): Promise<any> {
  return _build(rootPath, buildTargets, options || {});
}

export async function getOwners(
  rootPath: NuclideUri,
  filePath: NuclideUri,
  kindFilter?: string,
): Promise<Array<string>> {
  let queryString = `owner("${shellQuote([filePath])}")`;
  if (kindFilter != null) {
    queryString = `kind(${JSON.stringify(kindFilter)}, ${queryString})`;
  }
  return query(rootPath, queryString);
}

export function getRootForPath(file: NuclideUri): Promise<?NuclideUri> {
  return fsPromise.findNearestFile('.buckconfig', file);
}

/**
 * @param args Do not include 'buck' as the first argument: it will be added
 *     automatically.
 */
export async function runBuckCommandFromProjectRoot(
  rootPath: string,
  args: Array<string>,
  commandOptions?: ObserveProcessOptions,
  addClientId?: boolean = true,
  readOnly?: boolean = true,
): Promise<string> {
  const {
    pathToBuck,
    buckCommandOptions: options,
  } = await _getBuckCommandAndOptions(rootPath, commandOptions);

  const newArgs = addClientId ? args.concat(CLIENT_ID_ARGS) : args;
  return getPool(rootPath, readOnly).submit(() => {
    logger.debug(`Running \`${pathToBuck} ${shellQuote(args)}\``);
    return runCommand(pathToBuck, newArgs, options).toPromise();
  });
}

/** Runs `buck query --json` with the specified query. */
export async function query(
  rootPath: NuclideUri,
  queryString: string,
): Promise<Array<string>> {
  const args = ['query', '--json', queryString];
  const result = await runBuckCommandFromProjectRoot(rootPath, args);
  const json: Array<string> = JSON.parse(result);
  return json;
}

export async function getBuildFile(
  rootPath: NuclideUri,
  targetName: string,
): Promise<?string> {
  try {
    const result = await query(rootPath, `buildfile(${targetName})`);
    if (result.length === 0) {
      return null;
    }
    return nuclideUri.join(rootPath, result[0]);
  } catch (e) {
    logger.error(`No build file for target "${targetName}" ${e}`);
    return null;
  }
}
