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
import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {ConnectableObservable} from 'rxjs';
import type {ClangCompilationDatabase} from '../../nuclide-clang-rpc/lib/rpc-types';
import type {
  BaseBuckBuildOptions,
  ResolvedRuleType,
  CommandInfo,
} from './types';
import type {CompilationDatabaseParams} from '../../nuclide-buck/lib/types';

import {Observable} from 'rxjs';
import {runCommand, observeProcess} from 'nuclide-commons/process';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import createBuckWebSocket from './createBuckWebSocket';
import ini from 'ini';
import {getCompilationDatabaseHandler} from './BuckClangCompilationDatabase';
import * as BuckServiceImpl from './BuckServiceImpl';

export const MULTIPLE_TARGET_RULE_TYPE = 'multiple_targets';

export type BuckWebSocketMessage =
  | {
      // Not actually from Buck - this is to let the receiver know that the socket is connected.
      type: 'SocketConnected',
    }
  | {
      type: 'BuildProgressUpdated',
      progressValue: number,
    }
  | {
      type: 'BuildFinished',
      exitCode: number,
    }
  | {
      type: 'BuildStarted',
    }
  | {
      type: 'ConsoleEvent',
      message: string,
      level: {
        name:
          | 'OFF'
          | 'SEVERE'
          | 'WARNING'
          | 'INFO'
          | 'CONFIG'
          | 'FINE'
          | 'FINER'
          | 'FINEST'
          | 'ALL',
      },
    }
  | {
      type: 'ParseStarted',
    }
  | {
      type: 'ParseFinished',
    }
  | {
      type: 'InstallFinished',
      success: boolean,
      pid?: number,
    }
  | {
      type: 'RunStarted',
    }
  | {
      type: 'RunComplete',
    }
  | {
      type: 'ResultsAvailable',
      results: {
        buildTarget: {
          shortName: string,
          baseName: string,
        },
        success: boolean,
        failureCount: number,
        totalNumberOfTests: number,
        testCases: Array<{
          success: boolean,
          failureCount: number,
          skippedCount: number,
          testCaseName: string,
          testResults: Array<{
            testCaseName: string,
            testName: string,
            type: string,
            time: number,
            message: string,
            stacktrace: ?string,
            stdOut: string,
            stdErr: string,
          }>,
        }>,
      },
    }
  | {
      type: 'CompilerErrorEvent',
      error: string,
      suggestions: Array<mixed>, // TODO: use this?
      compilerType: string,
    };

type BuckConfig = Object;

/**
 * Given a file path, returns path to the Buck project root i.e. the directory containing
 * '.buckconfig' file.
 */
export function getRootForPath(file: NuclideUri): Promise<?NuclideUri> {
  return BuckServiceImpl.getRootForPath(file);
}

/**
 * Gets the build file for the specified target.
 */
export function getBuildFile(
  rootPath: NuclideUri,
  targetName: string,
): Promise<?string> {
  return BuckServiceImpl.getBuildFile(rootPath, targetName);
}

/**
 * Returns an array of strings (that are build targets) by running:
 *
 *     buck query owner(<path>)
 *
 * If `kindFilter` is provided, `kind(kindFilter, owner(..))` will be used.
 *
 * @param filePath absolute path or a local or a remote file.
 * @param kindFilter filter for specific build target kinds.
 * @return Promise that resolves to an array of build targets.
 */
export function getOwners(
  rootPath: NuclideUri,
  filePath: NuclideUri,
  kindFilter?: string,
): Promise<Array<string>> {
  return BuckServiceImpl.getOwners(rootPath, filePath, kindFilter);
}

/**
 * Reads the configuration file for the Buck project and returns the requested property.
 *
 * @param section Section in the configuration file.
 * @param property Configuration option within the section.
 *
 * @return Promise that resolves to the value, if it is set, else `null`.
 */
export async function getBuckConfig(
  rootPath: NuclideUri,
  section: string,
  property: string,
): Promise<?string> {
  const buckConfig = await _loadBuckConfig(rootPath);
  if (!buckConfig.hasOwnProperty(section)) {
    return null;
  }
  const sectionConfig = buckConfig[section];
  if (!sectionConfig.hasOwnProperty(property)) {
    return null;
  }
  return sectionConfig[property];
}

/**
 * TODO(natthu): Also load .buckconfig.local. Consider loading .buckconfig from the home directory
 * and ~/.buckconfig.d/ directory.
 */
async function _loadBuckConfig(rootPath: string): Promise<BuckConfig> {
  const header = 'scope = global\n';
  const buckConfigContent = await fsPromise.readFile(
    nuclideUri.join(rootPath, '.buckconfig'),
    'utf8',
  );
  return ini.parse(header + buckConfigContent);
}

/**
 * Runs `buck build --keep-going --build-report <tempfile>` with the specified targets. Regardless
 * whether the build is successful, this returns the parsed version of the JSON report
 * produced by the {@code --build-report} option:
 * http://facebook.github.io/buck/command/build.html.
 *
 * An error should be thrown only if the specified targets are invalid.
 * @return Promise that resolves to a build report.
 */
export function build(
  rootPath: NuclideUri,
  buildTargets: Array<string>,
  options?: BaseBuckBuildOptions,
): Promise<any> {
  return BuckServiceImpl.build(rootPath, buildTargets, options);
}

/**
 * Runs `buck install --keep-going --build-report <tempfile>` with the specified targets.
 *
 * @param run If set to 'true', appends the buck invocation with '--run' to run the
 *   installed application.
 * @param debug If set to 'true', appends the buck invocation with '--wait-for-debugger'
 *   telling the launched application to stop at the loader breakpoint
 *   waiting for debugger to connect
 * @param simulator The UDID of the simulator to install the binary on.
 * @return Promise that resolves to a build report.
 */
export function install(
  rootPath: NuclideUri,
  buildTargets: Array<string>,
  simulator: ?string,
  run: boolean,
  debug: boolean,
): Promise<any> {
  return BuckServiceImpl._build(rootPath, buildTargets, {
    install: true,
    simulator,
    run,
    debug,
  });
}

/**
 * Same as `build`, but returns additional output via an Observable.
 * @return An Observable with the following implementations:
 *   onNext: Calls the Observer with successive strings from stdout and stderr.
 *     Each update will be of the form: {stdout: string;} | {stderr: string;}
 *     TODO: Use a union to exactly match `{stdout: string;} | {stderr: string;}` when the service
 *     framework supports it. Use an object with optional keys to mimic the union.
 *   onError: If the build fails, calls the Observer with the string output
 *     from stderr.
 *   onCompleted: Only called if the build completes successfully.
 */
export function buildWithOutput(
  rootPath: NuclideUri,
  buildTargets: Array<string>,
  extraArguments: Array<string>,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return _buildWithOutput(rootPath, buildTargets, {extraArguments}).publish();
}

/**
 * Same as `build`, but returns additional output via an Observable.
 * @return An Observable with the following implementations:
 *   onNext: Calls the Observer with successive strings from stdout and stderr.
 *     Each update will be of the form: {stdout: string;} | {stderr: string;}
 *     TODO: Use a union to exactly match `{stdout: string;} | {stderr: string;}` when the service
 *     framework supports it. Use an object with optional keys to mimic the union.
 *   onError: If the build fails, calls the Observer with the string output
 *     from stderr.
 *   onCompleted: Only called if the build completes successfully.
 */
export function testWithOutput(
  rootPath: NuclideUri,
  buildTargets: Array<string>,
  extraArguments: Array<string>,
  debug: boolean,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return _buildWithOutput(rootPath, buildTargets, {
    test: true,
    extraArguments,
    debug,
  }).publish();
}

/**
 * Same as `install`, but returns additional output via an Observable.
 * @return An Observable with the following implementations:
 *   onNext: Calls the Observer with successive strings from stdout and stderr.
 *     Each update will be of the form: {stdout: string;} | {stderr: string;}
 *     TODO: Use a union to exactly match `{stdout: string;} | {stderr: string;}` when the service
 *     framework supports it. Use an object with optional keys to mimic the union.
 *   onError: If the install fails, calls the Observer with the string output
 *     from stderr.
 *   onCompleted: Only called if the install completes successfully.
 */
export function installWithOutput(
  rootPath: NuclideUri,
  buildTargets: Array<string>,
  extraArguments: Array<string>,
  simulator: ?string,
  run: boolean,
  debug: boolean,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return _buildWithOutput(rootPath, buildTargets, {
    install: true,
    simulator,
    run,
    debug,
    extraArguments,
  }).publish();
}

export function runWithOutput(
  rootPath: NuclideUri,
  buildTargets: Array<string>,
  extraArguments: Array<string>,
  simulator: ?string,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return _buildWithOutput(rootPath, buildTargets, {
    run: true,
    simulator,
    extraArguments,
  }).publish();
}

/**
 * Does a build/install.
 * @return An Observable that returns output from buck, as described by the
 *   docblocks for `buildWithOutput` and `installWithOutput`.
 */
function _buildWithOutput(
  rootPath: NuclideUri,
  buildTargets: Array<string>,
  options: BaseBuckBuildOptions,
): Observable<LegacyProcessMessage> {
  // TODO(T17463635)
  const args = BuckServiceImpl._translateOptionsToBuckBuildArgs({
    baseOptions: {...options},
    buildTargets,
  });
  return Observable.fromPromise(
    BuckServiceImpl._getBuckCommandAndOptions(rootPath),
  ).switchMap(({pathToBuck, buckCommandOptions}) =>
    observeProcess(pathToBuck, args, {
      ...buckCommandOptions,
      /* TODO(T17353599) */ isExitError: () => false,
    })
      .catch(error => Observable.of({kind: 'error', error})) // TODO(T17463635)
      .startWith({
        kind: 'stdout',
        data: `Starting "${pathToBuck} ${_getArgsStringSkipClientId(args)}"`,
      }),
  );
}

function _getArgsStringSkipClientId(args: Array<string>): string {
  const skipped = args.findIndex(arg => arg === 'client.id=nuclide');
  return args
    .filter((arg, index) => index !== skipped && index !== skipped - 1)
    .join(' ');
}

export async function listAliases(
  rootPath: NuclideUri,
): Promise<Array<string>> {
  const args = ['audit', 'alias', '--list'];
  const result = await BuckServiceImpl.runBuckCommandFromProjectRoot(
    rootPath,
    args,
  );
  const stdout = result.trim();
  return stdout ? stdout.split('\n') : [];
}

export async function listFlavors(
  rootPath: NuclideUri,
  targets: Array<string>,
  additionalArgs: Array<string> = [],
): Promise<?Object> {
  const args = ['audit', 'flavors', '--json']
    .concat(targets)
    .concat(additionalArgs);
  try {
    const result = await BuckServiceImpl.runBuckCommandFromProjectRoot(
      rootPath,
      args,
    );
    return JSON.parse(result);
  } catch (e) {
    return null;
  }
}

/**
 * Returns the build output metadata for the given target.
 * This will contain one element if the target is unique; otherwise it will
 * contain data for all the targets (e.g. for //path/to/targets:)
 *
 * The build output path is typically contained in the 'buck.outputPath' key.
 */
export async function showOutput(
  rootPath: NuclideUri,
  aliasOrTarget: string,
  extraArguments: Array<string> = [],
): Promise<Array<Object>> {
  const args = ['targets', '--json', '--show-output', aliasOrTarget].concat(
    extraArguments,
  );
  const result = await BuckServiceImpl.runBuckCommandFromProjectRoot(
    rootPath,
    args,
  );
  return JSON.parse(result.trim());
}

export async function buildRuleTypeFor(
  rootPath: NuclideUri,
  aliasesOrTargets: string,
): Promise<ResolvedRuleType> {
  const resolvedRuleTypes = await Promise.all(
    aliasesOrTargets
      .trim()
      .split(/\s+/)
      .map(target => _buildRuleTypeFor(rootPath, target)),
  );

  if (resolvedRuleTypes.length === 1) {
    return resolvedRuleTypes[0];
  } else {
    return {
      buildTarget: {
        qualifiedName: aliasesOrTargets,
        flavors: [],
      },
      type: MULTIPLE_TARGET_RULE_TYPE,
    };
  }
}

export async function _buildRuleTypeFor(
  rootPath: NuclideUri,
  aliasOrTarget: string,
): Promise<ResolvedRuleType> {
  let flavors;
  if (aliasOrTarget.includes('#')) {
    const nameComponents = aliasOrTarget.split('#');
    flavors = nameComponents.length === 2 ? nameComponents[1].split(',') : [];
  } else {
    flavors = [];
  }

  const canonicalName = _normalizeNameForBuckQuery(aliasOrTarget);
  const args = [
    'query',
    canonicalName,
    '--json',
    '--output-attributes',
    'buck.type',
  ];
  const result = await BuckServiceImpl.runBuckCommandFromProjectRoot(
    rootPath,
    args,
  );
  const json: {[target: string]: Object} = JSON.parse(result);
  // If aliasOrTarget is an alias, targets[0] will be the fully qualified build target.
  const targets = Object.keys(json);
  if (targets.length === 0) {
    throw new Error(`Error determining rule type of '${aliasOrTarget}'.`);
  }
  let qualifiedName;
  let type;
  // target: and target/... build a set of targets.
  // These don't have a single rule type so let's just return something.
  if (targets.length > 1) {
    qualifiedName = canonicalName;
    type = MULTIPLE_TARGET_RULE_TYPE;
  } else {
    qualifiedName = targets[0];
    type = json[qualifiedName]['buck.type'];
  }
  return {
    buildTarget: {
      qualifiedName,
      flavors,
    },
    type,
  };
}

// Buck query doesn't allow omitting // or adding # for flavors, this needs to be fixed in buck.
function _normalizeNameForBuckQuery(aliasOrTarget: string): string {
  let canonicalName = aliasOrTarget;
  // Don't prepend // for aliases (aliases will not have colons or .)
  if (
    (canonicalName.indexOf(':') !== -1 || canonicalName.indexOf('.') !== -1) &&
    !canonicalName.startsWith('//')
  ) {
    canonicalName = '//' + canonicalName;
  }
  // Strip flavor string
  const flavorIndex = canonicalName.indexOf('#');
  if (flavorIndex !== -1) {
    canonicalName = canonicalName.substr(0, flavorIndex);
  }
  return canonicalName;
}

const _cachedPorts = new Map();

export async function getHTTPServerPort(rootPath: NuclideUri): Promise<number> {
  let port = _cachedPorts.get(rootPath);
  if (port != null) {
    if (port === -1) {
      return port;
    }
    // If there are other builds on the promise queue, wait them out.
    // This ensures that we don't return the port for another build.
    await BuckServiceImpl.getPool(rootPath, false).submit(() =>
      Promise.resolve(),
    );
    const msg = await getWebSocketStream(rootPath, port)
      .refCount()
      .take(1)
      .toPromise()
      .catch(() => null);
    if (msg != null && msg.type === 'SocketConnected') {
      return port;
    }
  }

  const args = ['server', 'status', '--json', '--http-port'];
  const result = await BuckServiceImpl.runBuckCommandFromProjectRoot(
    rootPath,
    args,
  );
  const json: Object = JSON.parse(result);
  port = json['http.port'];
  _cachedPorts.set(rootPath, port);
  return port;
}

/** Runs `buck query --json` with the specified query. */
export function query(
  rootPath: NuclideUri,
  queryString: string,
): Promise<Array<string>> {
  return BuckServiceImpl.query(rootPath, queryString);
}

/**
 * Runs `buck query --json` with a query that contains placeholders and therefore expects
 * arguments.
 * @param query Should contain '%s' placeholders.
 * @param args Should be a list of build targets or aliases. The query will be run for each arg.
 *   It will be substituted for '%s' when it is run.
 * @return object where each arg in args will be a key. Its corresponding value will be the list
 *   of matching build targets in its results.
 */
export async function queryWithArgs(
  rootPath: NuclideUri,
  queryString: string,
  args: Array<string>,
): Promise<{[aliasOrTarget: string]: Array<string>}> {
  const completeArgs = ['query', '--json', queryString].concat(args);
  const result = await BuckServiceImpl.runBuckCommandFromProjectRoot(
    rootPath,
    completeArgs,
  );
  const json: {[aliasOrTarget: string]: Array<string>} = JSON.parse(result);

  // `buck query` does not include entries in the JSON for params that did not match anything. We
  // massage the output to ensure that every argument has an entry in the output.
  for (const arg of args) {
    if (!json.hasOwnProperty(arg)) {
      json[arg] = [];
    }
  }
  return json;
}

// TODO: Nuclide's RPC framework won't allow BuckWebSocketMessage here unless we cover
// all possible message types. For now, we'll manually typecast at the callsite.
export function getWebSocketStream(
  rootPath: NuclideUri,
  httpPort: number,
): ConnectableObservable<Object> {
  return createBuckWebSocket(httpPort).publish();
}

const LOG_PATH = 'buck-out/log/buck-0.log';
const LOG_REGEX = /\[([^\]]+)]/g;

function stripBrackets(str: string): string {
  return str.substring(1, str.length - 1);
}

export async function getLastCommandInfo(
  rootPath: NuclideUri,
  maxArgs?: number,
): Promise<?CommandInfo> {
  const logFile = nuclideUri.join(rootPath, LOG_PATH);
  if (await fsPromise.exists(logFile)) {
    let line;
    try {
      line = await runCommand('head', ['-n', '1', logFile]).toPromise();
    } catch (err) {
      return null;
    }
    const matches = line.match(LOG_REGEX);
    if (matches == null || matches.length < 2) {
      return null;
    }
    // Log lines are of the form:
    // [time][level][?][?][JavaClass] .... [args]
    // Parse this to figure out what the last command was.
    const timestamp = Number(new Date(stripBrackets(matches[0])));
    if (isNaN(timestamp)) {
      return null;
    }
    const args = stripBrackets(matches[matches.length - 1]).split(', ');
    if (args.length <= 1 || (maxArgs != null && args.length - 1 > maxArgs)) {
      return null;
    }
    return {timestamp, command: args[0], args: args.slice(1)};
  }
  return null;
}

export async function resetCompilationDatabaseForSource(
  src: NuclideUri,
  params: CompilationDatabaseParams,
): Promise<void> {
  getCompilationDatabaseHandler(params).resetForSource(src);
}

export async function resetCompilationDatabase(
  params: CompilationDatabaseParams,
): Promise<void> {
  getCompilationDatabaseHandler(params).reset();
}

export function getCompilationDatabase(
  src: NuclideUri,
  params: CompilationDatabaseParams,
): ConnectableObservable<?ClangCompilationDatabase> {
  return Observable.fromPromise(
    getCompilationDatabaseHandler(params).getCompilationDatabase(src),
  ).publish();
}
