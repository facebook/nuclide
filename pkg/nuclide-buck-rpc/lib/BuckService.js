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
import type {
  BaseBuckBuildOptions,
  ResolvedRuleType,
  CommandInfo,
  BuckClangCompilationDatabase,
} from './types';
import type {CompilationDatabaseParams} from '../../nuclide-buck/lib/types';

import {getLogger} from 'log4js';
import {Observable} from 'rxjs';
import {runCommand, observeProcess} from 'nuclide-commons/process';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import createBuckWebSocket from './createBuckWebSocket';
import invariant from 'assert';
import ini from 'ini';
import {getCompilationDatabaseHandler} from './BuckClangCompilationDatabase';
import * as BuckServiceImpl from './BuckServiceImpl';

export const MULTIPLE_TARGET_RULE_TYPE = 'multiple_targets';

// All Buck events should contain the fields the members in
// https://phabricator.internmc.facebook.com/diffusion/BUCK/browse/master/src/com/facebook/buck/event/AbstractBuckEvent.java
// Certain events maybe contain additional fields, defined in the interfaces in
// https://phabricator.internmc.facebook.com/diffusion/BUCK/browse/master/src/com/facebook/buck/event/external/events/
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
      buildId: string,
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
  extraArgs: Array<string>,
): Promise<?string> {
  return BuckServiceImpl.getBuildFile(rootPath, targetName, extraArgs);
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
 * @param extraArguments passed on the command line to buck query
 * @return Promise that resolves to an array of build targets.
 */
export function getOwners(
  rootPath: NuclideUri,
  filePath: NuclideUri,
  extraArguments: Array<string>,
  kindFilter?: string,
): Promise<Array<string>> {
  return BuckServiceImpl.getOwners(
    rootPath,
    filePath,
    extraArguments,
    kindFilter,
  );
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
  // NOTE: This function should really just be a call to `buck audit config`.
  // Unfortunately, at time of writing, making such a call takes between 800ms
  // (with buckd warmed and ready to go) to 4 seconds (when restarting buckd),
  // or potentially even 10 seconds (if we need to download a new version of
  // buck). In other words, not viable for performance-sensitive code.
  const buckConfig = await _loadBuckConfig(rootPath);
  if (!buckConfig.hasOwnProperty(section)) {
    return null;
  }
  const sectionConfig = buckConfig[section];
  if (!sectionConfig.hasOwnProperty(property)) {
    return null;
  }
  return _resolveValue(sectionConfig[property], buckConfig);
}

/**
 * TODO(natthu): Also load .buckconfig.local. Consider loading .buckconfig from the home directory
 * and ~/.buckconfig.d/ directory.
 */
async function _loadBuckConfig(rootPath: string): Promise<BuckConfig> {
  const header = 'scope = global\n';
  const buckConfigPath = nuclideUri.join(rootPath, '.buckconfig');
  const buckConfigContent = await _readBuckConfigFile(buckConfigPath);
  return ini.parse(header + buckConfigContent);
}

/**
 * Reads a .buckconfig file, resolving any includes which may be contained
 * within. Returns the full buckconfig contents after resolving includes.
 */
async function _readBuckConfigFile(configPath: string): Promise<string> {
  const contents = await fsPromise.readFile(configPath, 'utf8');
  const configDir = nuclideUri.dirname(configPath);
  return _replaceAsync(
    /<file:(.*)>$/gm,
    contents,
    async (match, includeRelpath) => {
      const includePath = nuclideUri.normalize(
        nuclideUri.join(configDir, includeRelpath),
      );
      return _readBuckConfigFile(includePath);
    },
  );
}

async function _replaceAsync(
  regexp: RegExp,
  str: string,
  callback: (substring: string, ...args: Array<any>) => Promise<string>,
): Promise<string> {
  const replacePromises = [];

  str.replace(regexp, (...replaceArgs) => {
    replacePromises.push(callback(...replaceArgs));
    return replaceArgs[0];
  });

  const results = await Promise.all(replacePromises);

  return str.replace(regexp, () => results.shift());
}

/**
 * Takes a string `value` pulled from a buckconfig and resolves any
 * `$(config ...)` macros inside, using the data from config.
 */
function _resolveValue(value: string, config: BuckConfig): string {
  return value.replace(/\$\(config (.*)\)/g, directive => {
    const requestedConfig = directive.substring(9, directive.length - 1);
    const pieces = requestedConfig.split('.');
    // configs should be of the form `foo.bar`
    invariant(pieces.length === 2);
    return config[pieces[0]][pieces[1]];
  });
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
  return BuckServiceImpl.build(rootPath, buildTargets, options).toPromise();
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
  }).toPromise();
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
  ).toPromise();
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
    ).toPromise();
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
  ).toPromise();
  return JSON.parse(result.trim());
}

export async function buildRuleTypeFor(
  rootPath: NuclideUri,
  aliasesOrTargets: string,
): Promise<?ResolvedRuleType> {
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

export async function clean(rootPath: NuclideUri): Promise<void> {
  await BuckServiceImpl.runBuckCommandFromProjectRoot(rootPath, [
    'clean',
  ]).toPromise();
}

export async function kill(rootPath: NuclideUri): Promise<void> {
  await BuckServiceImpl.runBuckCommandFromProjectRoot(
    rootPath,
    ['kill'],
    {},
    false,
  ).toPromise();
}

export async function _buildRuleTypeFor(
  rootPath: NuclideUri,
  aliasOrTarget: string,
): Promise<?ResolvedRuleType> {
  let flavors;
  if (aliasOrTarget.includes('#')) {
    const nameComponents = aliasOrTarget.split('#');
    flavors = nameComponents.length === 2 ? nameComponents[1].split(',') : [];
  } else {
    flavors = [];
  }

  const canonicalName = _normalizeNameForBuckQuery(aliasOrTarget);
  let result: {[target: string]: Object};
  try {
    result = await BuckServiceImpl.query(rootPath, canonicalName, [
      '--output-attributes',
      'buck.type',
    ]).toPromise();
  } catch (error) {
    getLogger('nuclide-buck-rpc').error(error.message);
    return null;
  }
  // If aliasOrTarget is an alias, targets[0] will be the fully qualified build target.
  const targets = Object.keys(result);
  if (targets.length === 0) {
    return null;
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
    type = result[qualifiedName]['buck.type'];
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
    canonicalName.indexOf('//') === -1
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

// Returns -1 if the port can't be obtained (e.g. calling `buck server` fails)
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
  try {
    const result = await BuckServiceImpl.runBuckCommandFromProjectRoot(
      rootPath,
      args,
    ).toPromise();
    const json: Object = JSON.parse(result);
    port = json['http.port'];
    _cachedPorts.set(rootPath, port);
    return port;
  } catch (error) {
    getLogger('nuclide-buck-rpc').warn(
      `Failed to get httpPort for ${nuclideUri.getPath(rootPath)}`,
      error,
    );
    return -1;
  }
}

/** Runs `buck query --json` with the specified query. */
export function query(
  rootPath: NuclideUri,
  queryString: string,
  extraArguments: Array<string>,
): Promise<Array<string>> {
  return BuckServiceImpl.query(
    rootPath,
    queryString,
    extraArguments,
  ).toPromise();
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
): Promise<any> {
  const result: {
    [aliasOrTarget: string]: Array<string>,
  } = await BuckServiceImpl.query(rootPath, queryString, args).toPromise();
  // `buck query` does not include entries in the JSON for params that did not match anything. We
  // massage the output to ensure that every argument has an entry in the output.
  for (const arg of args) {
    if (!result.hasOwnProperty(arg)) {
      result[arg] = [];
    }
  }
  return result;
}

/**
 * Executes a query with additional attributes.
 * Example output:
 *   queryWithAttributes(rootPath, 'owner(foo.py)', ['buck.type', 'deps']) =>
 *   {
 *      "//foo:foo": {
 *        "buck.type": "python_library",
 *        "deps": [],
 *      }
 *   }
 */
export async function queryWithAttributes(
  rootPath: NuclideUri,
  queryString: string,
  attributes: Array<string>,
): Promise<any> {
  const result: {
    [aliasOrTarget: string]: {[attribute: string]: mixed},
  } = await BuckServiceImpl.query(rootPath, queryString, [
    '--output-attributes',
    ...attributes,
  ]).toPromise();
  return result;
}

// TODO: Nuclide's RPC framework won't allow BuckWebSocketMessage here unless we cover
// all possible message types. For now, we'll manually typecast at the callsite.
export function getWebSocketStream(
  rootPath: NuclideUri,
  httpPort: number,
): ConnectableObservable<Object> {
  return createBuckWebSocket(httpPort).publish();
}

const LOG_PATH = 'buck-out/log/last_buildcommand/buck-machine-log';
const INVOCATIONINFO_REGEX = /InvocationInfo ({.+})/;

export async function getLastBuildCommandInfo(
  rootPath: NuclideUri,
): Promise<?CommandInfo> {
  // Buck machine log has the format < Event type >< space >< JSON >, one per line.
  // https://buckbuild.com/concept/buckconfig.html#log.machine_readable_logger_enabled
  const logFile = nuclideUri.join(rootPath, LOG_PATH);
  if (await fsPromise.exists(logFile)) {
    let line;
    try {
      line = await runCommand('head', ['-n', '1', logFile], {
        dontLogInNuclide: true,
      }).toPromise();
    } catch (err) {
      return null;
    }
    const matches = INVOCATIONINFO_REGEX.exec(line);
    if (matches == null || matches.length < 2) {
      return null;
    }
    try {
      const invocationParams = JSON.parse(matches[1]);
      // Invocation fields defined in buck/log/AbstractInvocationInfo.java
      return {
        timestamp: invocationParams.timestampMillis,
        command: 'build',
        args: invocationParams.unexpandedCommandArgs.slice(1),
      };
    } catch (err) {
      // If it doesn't parse then just give up.
      return null;
    }
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
): ConnectableObservable<?BuckClangCompilationDatabase> {
  return getCompilationDatabaseHandler(params)
    .getCompilationDatabase(src)
    .publish();
}

export function isNativeExoPackage(
  rootPath: NuclideUri,
  target: string,
): ConnectableObservable<boolean> {
  return Observable.defer(async () => {
    const exoPackageModes = await getExoPackageModes(rootPath, target);
    return exoPackageModes.indexOf('native_library') >= 0;
  }).publish();
}

export function isExoPackage(
  rootPath: NuclideUri,
  target: string,
): ConnectableObservable<boolean> {
  return Observable.defer(async () => {
    const exoPackageModes = await getExoPackageModes(rootPath, target);
    return exoPackageModes.length > 0;
  }).publish();
}

async function getExoPackageModes(
  rootPath: NuclideUri,
  target: string,
): Promise<Array<string>> {
  const attributes = await queryWithAttributes(rootPath, target, [
    'exopackage_modes',
  ]);
  if (
    attributes[target] != null &&
    attributes[target].exopackage_modes instanceof Array
  ) {
    return attributes[target].exopackage_modes;
  } else {
    return [];
  }
}
