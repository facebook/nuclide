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
import type {
  MerlinError,
  MerlinOutline,
  MerlinType,
  MerlinCases,
  MerlinPosition,
  MerlinOccurrences,
} from '..';

import nuclideUri from 'nuclide-commons/nuclideUri';
import readline from 'readline';

import fsPromise from 'nuclide-commons/fsPromise';
import {
  runCommand,
  spawn,
  getOriginalEnvironment,
} from 'nuclide-commons/process';
import {PromiseQueue} from '../../commons-node/promise-executors';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-ocaml-rpc');

const ERROR_RESPONSES = new Set(['failure', 'error', 'exception']);

/**
 * Wraps an ocamlmerlin process; provides api access to
 * ocamlmerlin's json-over-stdin/stdout protocol.
 * Derived classes spec which version of the protocol to speak.
 */
export type MerlinProcess = {
  isRunning(): boolean,

  /**
   * Tell merlin where to find its per-repo .merlin config file.
   *
   * Configuration file format description:
   *   https://github.com/the-lambda-church/merlin/wiki/project-configuration
   *
   * @return a dummy cursor position on success
   */
  pushDotMerlinPath(file: NuclideUri): Promise<mixed>,

  /**
   * Set the buffer content to query against. Merlin uses an internal
   * buffer (name + content) that is independent from file content on
   * disk.
   *
   * @return on success: a cursor position pointed at the end of the buffer
   */
  pushNewBuffer(name: NuclideUri, content: string): Promise<mixed>,

  /**
   * Find definition
   *
   * `kind` is one of 'ml' or 'mli'
   *
   * Note: ocamlmerlin line numbers are 1-based.
   * @return null if nothing was found; a position of the form
   *   {"file": "somepath", "pos": {"line": 41, "col": 5}}.
   */
  locate(
    file: NuclideUri,
    line: number,
    col: number,
    kind: string,
  ): Promise<?{file: string, pos: {line: number, col: number}}>,

  enclosingType(
    file: NuclideUri,
    line: number,
    col: number,
  ): Promise<Array<MerlinType>>,

  complete(
    file: NuclideUri,
    line: number,
    col: number,
    prefix: string,
  ): Promise<mixed>,

  errors(file: NuclideUri): Promise<Array<MerlinError>>,

  outline(file: NuclideUri): Promise<Array<MerlinOutline>>,

  cases(
    file: NuclideUri,
    start: MerlinPosition,
    end: MerlinPosition,
  ): Promise<MerlinCases>,

  // This is currently unused; waiting for the refactoring front-end to finish.
  occurrences(
    file: NuclideUri,
    line: number,
    col: number,
  ): Promise<MerlinOccurrences>,

  /**
   * Run a command; parse the json output, return an object. This assumes
   * that merlin's protocol is line-based (results are json objects rendered
   * on a single line).
   */
  runSingleCommand(command: mixed, file: NuclideUri): Promise<Object>,

  dispose(): void,
};

class MerlinProcessBase {
  _proc: child_process$ChildProcess;
  _promiseQueue: PromiseQueue;
  _running: boolean;

  constructor(proc: child_process$ChildProcess) {
    this._proc = proc;
    this._promiseQueue = new PromiseQueue();
    this._running = true;
    this._proc.on('exit', (code, signal) => {
      this._running = false;
    });
  }

  isRunning(): boolean {
    return this._running;
  }

  dispose() {
    this._proc.kill();
  }
}

/**
 * Wraps an ocamlmerlin process which talks v1 protocol; provides api access to
 * ocamlmerlin's json-over-stdin/stdout protocol.
 *
 * This is based on the protocol description at:
 *   https://github.com/the-lambda-church/merlin/blob/merlin1/PROTOCOL.md
 *   https://github.com/the-lambda-church/merlin/tree/master/src/frontend
 */
export class MerlinProcessV2_3_1 extends MerlinProcessBase {
  constructor(proc: child_process$ChildProcess) {
    super(proc);
  }

  runSingleCommand(command: mixed, file: NuclideUri): Promise<Object> {
    // v2.3.x don't support Reason, so the file path isn't used; it's used by
    // v2.5.1+ though, so we have the variable here for typing consistency
    // purpose.
    return runSingleCommandImpl(this._proc, command);
  }

  async pushDotMerlinPath(file: NuclideUri): Promise<mixed> {
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(['reset', 'dot_merlin', [file], 'auto'], file),
    );
  }

  async pushNewBuffer(name: NuclideUri, content: string): Promise<mixed> {
    return this._promiseQueue.submit(async () => {
      await this.runSingleCommand(['reset', 'auto', name], name);
      // Clear the buffer.
      await this.runSingleCommand(['seek', 'exact', {line: 1, col: 0}], name);
      await this.runSingleCommand(['drop'], name);

      const result = await this.runSingleCommand(
        ['tell', 'source-eof', content],
        name,
      );

      return result;
    });
  }

  async locate(
    file: NuclideUri,
    line: number,
    col: number,
    kind: string,
  ): Promise<?{file: string, pos: {line: number, col: number}}> {
    return this._promiseQueue.submit(async () => {
      const location = await this.runSingleCommand(
        ['locate', /* identifier name */ '', kind, 'at', {line: line + 1, col}],
        file,
      );

      if (typeof location === 'string') {
        throw new Error(location);
      }

      // Ocamlmerlin doesn't include a `file` field at all if the destination is
      // in the same file.
      if (!location.file) {
        location.file = file;
      }

      return location;
    });
  }

  async enclosingType(
    file: NuclideUri,
    line: number,
    col: number,
  ): Promise<Array<MerlinType>> {
    // $FlowFixMe: runSingleCommand returns `Promise<Object>`, should me mixed.
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(
        ['type', 'enclosing', 'at', {line: line + 1, col}],
        file,
      ),
    );
  }

  async complete(
    file: NuclideUri,
    line: number,
    col: number,
    prefix: string,
  ): Promise<mixed> {
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(
        ['complete', 'prefix', prefix, 'at', {line: line + 1, col: col + 1}],
        file,
      ),
    );
  }

  async errors(path: NuclideUri): Promise<Array<MerlinError>> {
    // $FlowFixMe: runSingleCommand returns `Promise<Object>`, should me mixed.
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(['errors'], path),
    );
  }

  async outline(path: NuclideUri): Promise<Array<MerlinOutline>> {
    // $FlowFixMe: runSingleCommand returns `Promise<Object>`, should me mixed.
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(['outline'], path),
    );
  }

  async cases(
    path: NuclideUri,
    start: MerlinPosition,
    end: MerlinPosition,
  ): Promise<MerlinCases> {
    // $FlowFixMe: runSingleCommand returns `Promise<Object>`, should me mixed.
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(
        ['case', 'analysis', 'from', start, 'to', end],
        path,
      ),
    );
  }

  async occurrences(
    path: NuclideUri,
    line: number,
    col: number,
  ): Promise<MerlinOccurrences> {
    // $FlowFixMe: runSingleCommand returns `Promise<Object>`, should me mixed.
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(
        ['occurrences', 'ident', 'at', {line: line + 1, col: col + 1}],
        path,
      ),
    );
  }
}

/**
 * Wraps an ocamlmerlin process which talks v2 protocol; provides api access to
 * ocamlmerlin's json-over-stdin/stdout protocol.
 *
 * This is based on the protocol description at:
 *   https://github.com/the-lambda-church/merlin/blob/master/doc/dev/PROTOCOL.md
 *   https://github.com/the-lambda-church/merlin/tree/master/src/frontend
 */
export class MerlinProcessV2_5 extends MerlinProcessBase {
  constructor(proc: child_process$ChildProcess) {
    super(proc);
  }

  runSingleCommand(
    command: mixed,
    file: NuclideUri,
    wrapForContext?: boolean,
  ): Promise<Object> {
    // contextify is important needed for Reason support.
    // https://github.com/the-lambda-church/merlin/blob/d98a08d318ca14d9c702bbd6eeadbb762d325ce7/doc/dev/PROTOCOL.md#contextual-commands
    const wrappedCommand = wrapForContext === false
      ? command
      : {query: command, context: ['auto', file]};
    return runSingleCommandImpl(this._proc, wrappedCommand);
  }

  async pushDotMerlinPath(file: NuclideUri): Promise<mixed> {
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(
        ['reset', 'dot_merlin', [file], 'auto'],
        file,
        false,
      ),
    );
  }

  /**
   * Set the buffer content to query against. Merlin uses an internal
   * buffer (name + content) that is independent from file content on
   * disk.
   *
   * @return on success: a cursor position pointed at the end of the buffer
   */
  async pushNewBuffer(name: NuclideUri, content: string): Promise<mixed> {
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(['tell', 'start', 'end', content], name),
    );
  }

  /**
   * Find definition
   *
   * `kind` is one of 'ml' or 'mli'
   *
   * Note: ocamlmerlin line numbers are 1-based.
   * @return null if nothing was found; a position of the form
   *   {"file": "somepath", "pos": {"line": 41, "col": 5}}.
   */
  async locate(
    file: NuclideUri,
    line: number,
    col: number,
    kind: string,
  ): Promise<?{file: string, pos: {line: number, col: number}}> {
    return this._promiseQueue.submit(async () => {
      const location = await this.runSingleCommand(
        ['locate', /* identifier name */ '', kind, 'at', {line: line + 1, col}],
        file,
      );

      if (typeof location === 'string') {
        throw new Error(location);
      }

      // Ocamlmerlin doesn't include a `file` field at all if the destination is
      // in the same file.
      if (!location.file) {
        location.file = file;
      }

      return location;
    });
  }

  async enclosingType(
    file: NuclideUri,
    line: number,
    col: number,
  ): Promise<Array<MerlinType>> {
    // $FlowFixMe: runSingleCommand returns `Promise<Object>`, should me mixed.
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(
        ['type', 'enclosing', 'at', {line: line + 1, col}],
        file,
      ),
    );
  }

  async complete(
    file: NuclideUri,
    line: number,
    col: number,
    prefix: string,
  ): Promise<mixed> {
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(
        ['complete', 'prefix', prefix, 'at', {line: line + 1, col: col + 1}],
        file,
      ),
    );
  }

  async errors(path: NuclideUri): Promise<Array<MerlinError>> {
    // $FlowFixMe: runSingleCommand returns `Promise<Object>`, should me mixed.
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(['errors'], path),
    );
  }

  async outline(path: NuclideUri): Promise<Array<MerlinOutline>> {
    // $FlowFixMe: runSingleCommand returns `Promise<Object>`, should me mixed.
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(['outline'], path),
    );
  }

  async cases(
    path: NuclideUri,
    start: MerlinPosition,
    end: MerlinPosition,
  ): Promise<MerlinCases> {
    // $FlowFixMe: runSingleCommand returns `Promise<Object>`, should me mixed.
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(
        ['case', 'analysis', 'from', start, 'to', end],
        path,
      ),
    );
  }

  async occurrences(
    path: NuclideUri,
    line: number,
    col: number,
  ): Promise<MerlinOccurrences> {
    // $FlowFixMe: runSingleCommand returns `Promise<Object>`, should me mixed.
    return this._promiseQueue.submit(() =>
      this.runSingleCommand(
        ['occurrences', 'ident', 'at', {line: line + 1, col: col + 1}],
        path,
      ),
    );
  }
}

let merlinProcessInstance: ?MerlinProcess;

export async function getInstance(file: NuclideUri): Promise<?MerlinProcess> {
  if (merlinProcessInstance && merlinProcessInstance.isRunning()) {
    return merlinProcessInstance;
  }

  const merlinPath = getPathToMerlin();
  const flags = getMerlinFlags();

  const version = await getMerlinVersion(merlinPath);
  if (version === null) {
    return null;
  }

  const dotMerlinPath = await fsPromise.findNearestFile('.merlin', file);

  const options = {
    cwd: dotMerlinPath ? nuclideUri.dirname(dotMerlinPath) : '.',
    // Starts the process with the user's bashrc, which might contain a
    // different ocamlmerlin. See `getMerlinVersion` for the same consistent
    // logic. This also implies .nucliderc isn't considered, if there's any
    // extra override; to simulate the same behavior, do this in your bashrc:
    // if [ "$TERM" = "nuclide"]; then someOverrideLogic if
    env: await getOriginalEnvironment(),
  };

  logger.info('Spawning new ocamlmerlin process version ' + version);
  const processStream = spawn(merlinPath, flags, options).publish();
  const processPromise = processStream.take(1).toPromise();
  processStream.connect();
  const process = await processPromise;
  // Turns 2.5.1 into 2.5
  const majorMinor = version.split('.').slice(0, 2).join('.');
  switch (majorMinor) {
    case '2.5':
      merlinProcessInstance = new MerlinProcessV2_5(process);
      break;
    case '2.3':
      merlinProcessInstance = new MerlinProcessV2_3_1(process);
      break;
    default:
      logger.error(`Unsupported merlin version: ${version}`);
      return null;
  }

  if (dotMerlinPath) {
    // TODO(pieter) add support for multiple .dotmerlin files
    await merlinProcessInstance.pushDotMerlinPath(dotMerlinPath);
    logger.debug('Added .merlin path: ' + dotMerlinPath);
  }

  return merlinProcessInstance;
}

/**
 * @return The path to ocamlmerlin on the user's machine. It is recommended not to cache the result
 *   of this function in case the user updates his or her preferences in Atom, in which case the
 *   return value will be stale.
 */
function getPathToMerlin(): string {
  return (
    (global.atom &&
      global.atom.config.get('nuclide.nuclide-ocaml.pathToMerlin')) ||
    'ocamlmerlin'
  );
}

/**
 * @return The set of arguments to pass to ocamlmerlin.
 */
function getMerlinFlags(): Array<string> {
  const configVal =
    global.atom && global.atom.config.get('nuclide.nuclide-ocaml.merlinFlags');
  // To split while stripping out any leading/trailing space, we match on all
  // *non*-whitespace.
  const configItems = configVal && configVal.match(/\S+/g);
  return configItems || [];
}

let merlinVersionCache: ?string;
async function getMerlinVersion(merlinPath: string): Promise<string | null> {
  if (merlinVersionCache === undefined) {
    let stdout;
    try {
      stdout = await runCommand(merlinPath, ['-version'], {
        env: await getOriginalEnvironment(),
      }).toPromise();
    } catch (err) {
      logger.info('ocamlmerlin not installed');
      merlinVersionCache = null;
      return merlinVersionCache;
    }
    const match = stdout.match(/^The Merlin toolkit version (\d+(?:\.\d)*),/);
    if (match != null && match[1] != null) {
      merlinVersionCache = match[1];
    } else {
      logger.info('unable to determine ocamlmerlin version');
      merlinVersionCache = null;
    }
  }
  return merlinVersionCache;
}

/**
 * Run a command; parse the json output, return an object. This assumes
 * that merlin's protocol is line-based (results are json objects rendered
 * on a single line).
 */
function runSingleCommandImpl(
  process: child_process$ChildProcess,
  command: mixed,
): Promise<Object> {
  const commandString = JSON.stringify(command);
  const stdin = process.stdin;
  const stdout = process.stdout;

  return new Promise((resolve, reject) => {
    const reader = readline.createInterface({
      input: stdout,
      terminal: false,
    });

    reader.on('line', line => {
      reader.close();
      let response;
      try {
        response = JSON.parse(line);
      } catch (err) {
        response = null;
      }
      if (!response || !Array.isArray(response) || response.length !== 2) {
        logger.error('Unexpected response from ocamlmerlin: ${line}');
        reject(Error('Unexpected ocamlmerlin output format'));
        return;
      }

      const status = response[0];
      const content = response[1];

      if (ERROR_RESPONSES.has(status)) {
        logger.error(
          `Ocamlmerlin raised an error: ${line}\n  command: ${commandString}`,
        );
        reject(Error('Ocamlmerlin returned an error'));
        return;
      }

      resolve(content);
    });

    stdin.write(commandString);
  });
}
