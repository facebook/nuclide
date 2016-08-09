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
import type {MerlinError, MerlinOutline, MerlinType} from '..';

import nuclideUri from '../../commons-node/nuclideUri';
import readline from 'readline';

import fsPromise from '../../commons-node/fsPromise';
import {asyncExecute, safeSpawn} from '../../commons-node/process';
import {PromiseQueue} from '../../commons-node/promise-executors';
import {getLogger} from '../../nuclide-logging';

const logger = getLogger();

const ERROR_RESPONSES = new Set([
  'failure',
  'error',
  'exception',
]);

/**
 * Wraps an ocamlmerlin process; provides api access to
 * ocamlmerlin's json-over-stdin/stdout protocol.
 * Derived classes spec which version of the protocol to speak.
 */
export type MerlinProcess = {

  isRunning(): bool,

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

  complete(file: NuclideUri, line: number, col: number, prefix: string): Promise<mixed>,

  errors(): Promise<Array<MerlinError>>,

  outline(file: NuclideUri): Promise<Array<MerlinOutline>>,

  /**
   * Run a command; parse the json output, return an object. This assumes
   * that merlin's protocol is line-based (results are json objects rendered
   * on a single line).
   */
  runSingleCommand(command: mixed): Promise<Object>,

  dispose(): void,
};

class MerlinProcessBase {
  _proc: child_process$ChildProcess;
  _promiseQueue: PromiseQueue;
  _running: bool;

  constructor(proc: child_process$ChildProcess) {
    this._proc = proc;
    this._promiseQueue = new PromiseQueue();
    this._running = true;
    this._proc.on('exit', (code, signal) => { this._running = false; });
  }

  isRunning(): bool {
    return this._running;
  }

  runSingleCommand(command: mixed): Promise<Object> {
    return runSingleCommand(this._proc, command);
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

  async pushDotMerlinPath(file: NuclideUri): Promise<mixed> {
    return await this._promiseQueue.submit(async (resolve, reject) => {
      const result = await this.runSingleCommand([
        'reset',
        'dot_merlin',
        [file],
        'auto',
      ]);
      resolve(result);
    });
  }

  async pushNewBuffer(name: NuclideUri, content: string): Promise<mixed> {
    return await this._promiseQueue.submit(async (resolve, reject) => {
      await this.runSingleCommand([
        'reset',
        'auto', // one of {ml, mli, auto}
        name,
      ]);

      // Clear the buffer.
      await this.runSingleCommand([
        'seek',
        'exact',
        {line: 1, col: 0},
      ]);
      await this.runSingleCommand(['drop']);

      const result = await this.runSingleCommand([
        'tell',
        'source-eof',
        content,
      ]);
      resolve(result);
    });
  }

  async locate(
    file: NuclideUri,
    line: number,
    col: number,
    kind: string,
  ): Promise<?{file: string, pos: {line: number, col: number}}> {
    return await this._promiseQueue.submit(async (resolve, reject) => {
      const location = await this.runSingleCommand([
        'locate',
        /* identifier name */ '',
        kind,
        'at',
        {line: line + 1, col},
      ]);


      if (typeof location === 'string') {
        return reject(Error(location));
      }

      // Ocamlmerlin doesn't include a `file` field at all if the destination is
      // in the same file.
      if (!location.file) {
        location.file = file;
      }

      resolve(location);
    });
  }

  async enclosingType(
    file: NuclideUri,
    line: number,
    col: number,
  ): Promise<Array<MerlinType>> {
    return await this._promiseQueue.submit((resolve, reject) => {
      this.runSingleCommand(['type', 'enclosing', 'at', {line: line + 1, col}])
        .then(resolve)
        .catch(reject);
    });
  }

  async complete(file: NuclideUri, line: number, col: number, prefix: string): Promise<mixed> {
    return await this._promiseQueue.submit((resolve, reject) => {
      this.runSingleCommand([
        'complete',
        'prefix',
        prefix,
        'at',
        {line: line + 1, col: col + 1},
      ]).then(resolve)
        .catch(reject);
    });
  }

  async errors(): Promise<Array<MerlinError>> {
    return await this._promiseQueue.submit((resolve, reject) => {
      this.runSingleCommand(['errors'])
        .then(resolve)
        .catch(reject);
    });
  }

  async outline(path: NuclideUri): Promise<Array<MerlinOutline>> {
    return await this._promiseQueue.submit((resolve, reject) => {
      this.runSingleCommand(['outline'])
        .then(resolve)
        .catch(reject);
    });
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

  async pushDotMerlinPath(file: NuclideUri): Promise<mixed> {
    return await this._promiseQueue.submit(async (resolve, reject) => {
      const result = await this.runSingleCommand([
        'reset',
        'dot_merlin',
        [file],
        'auto',
      ]);
      resolve(result);
    });
  }

  /**
   * Set the buffer content to query against. Merlin uses an internal
   * buffer (name + content) that is independent from file content on
   * disk.
   *
   * @return on success: a cursor position pointed at the end of the buffer
   */
  async pushNewBuffer(name: NuclideUri, content: string): Promise<mixed> {
    return await this._promiseQueue.submit(async (resolve, reject) => {
      const result = await this.runSingleCommand([
        'tell',
        'start',
        'end',
        content,
      ]);
      resolve(result);
    });
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
    return await this._promiseQueue.submit(async (resolve, reject) => {
      const location = await this.runSingleCommand([
        'locate',
        /* identifier name */ '',
        kind,
        'at',
        {line: line + 1, col},
      ]);


      if (typeof location === 'string') {
        return reject(Error(location));
      }

      // Ocamlmerlin doesn't include a `file` field at all if the destination is
      // in the same file.
      if (!location.file) {
        location.file = file;
      }

      resolve(location);
    });
  }

  async enclosingType(
    file: NuclideUri,
    line: number,
    col: number,
  ): Promise<Array<MerlinType>> {
    return await this._promiseQueue.submit((resolve, reject) => {
      this.runSingleCommand(['type', 'enclosing', 'at', {line: line + 1, col}])
        .then(resolve)
        .catch(reject);
    });
  }

  async complete(file: NuclideUri, line: number, col: number, prefix: string): Promise<mixed> {
    return await this._promiseQueue.submit((resolve, reject) => {
      this.runSingleCommand([
        'complete',
        'prefix',
        prefix,
        'at',
        {line: line + 1, col: col + 1},
      ]).then(resolve)
        .catch(reject);
    });
  }

  async errors(): Promise<Array<MerlinError>> {
    return await this._promiseQueue.submit((resolve, reject) => {
      this.runSingleCommand(['errors'])
        .then(resolve)
        .catch(reject);
    });
  }

  async outline(path: NuclideUri): Promise<Array<MerlinOutline>> {
    return await this._promiseQueue.submit((resolve, reject) => {
      this.runSingleCommand(['outline'])
        .then(resolve)
        .catch(reject);
    });
  }
}

let merlinProcessInstance: ?MerlinProcess;

export async function getInstance(file: NuclideUri): Promise<?MerlinProcess> {
  if (merlinProcessInstance && merlinProcessInstance.isRunning()) {
    return merlinProcessInstance;
  }

  const merlinPath = getPathToMerlin();
  const flags = getMerlinFlags();

  if (!await isInstalled(merlinPath)) {
    return null;
  }

  const dotMerlinPath = await fsPromise.findNearestFile('.merlin', file);

  const options = {
    cwd: (dotMerlinPath ? nuclideUri.dirname(dotMerlinPath) : '.'),
  };

  logger.info('Spawning new ocamlmerlin process');
  const process = await safeSpawn(merlinPath, flags, options);
  const version = await getVersion(process);
  switch (version) {
    case '2.5.0':
      merlinProcessInstance = new MerlinProcessV2_5(process);
      break;
    case '2.3.1':
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

async function getVersion(proc: child_process$ChildProcess): Promise<string> {
  let version;
  try {
    // TODO: Support version 3
    const result = await runSingleCommand(proc, [
      'protocol',
      'version',
      2, // default to version 2
    ]);
    const match = result.merlin.match(/^The Merlin toolkit version (\d+(\.\d)*),/);
    return match != null && match[1] != null ? match[1] : '2.3.1';
  } catch (e) {
    // version 2.3.1 doesn't have a 'protocol' command and will throw
    version = '2.3.1';
  }
  return version;
}

/**
 * @return The path to ocamlmerlin on the user's machine. It is recommended not to cache the result
 *   of this function in case the user updates his or her preferences in Atom, in which case the
 *   return value will be stale.
 */
function getPathToMerlin(): string {
  return global.atom
    && global.atom.config.get('nuclide.nuclide-ocaml.pathToMerlin') || 'ocamlmerlin';
}

/**
 * @return The set of arguments to pass to ocamlmerlin.
 */
function getMerlinFlags(): Array<string> {
  const configVal = global.atom
    && global.atom.config.get('nuclide.nuclide-ocaml.merlinFlags');
  // To split while stripping out any leading/trailing space, we match on all
  // *non*-whitespace.
  const configItems = configVal && configVal.match(/\S+/g);
  return configItems || [];
}

let isInstalledCache: ?boolean = null;
async function isInstalled(merlinPath: string): Promise<boolean> {
  if (isInstalledCache == null) {
    const result = await asyncExecute('which', [merlinPath]);
    isInstalledCache = result.exitCode === 0;
    if (!isInstalledCache) {
      logger.info('ocamlmerlin not installed');
    }
  }
  return isInstalledCache;
}

/**
 * Run a command; parse the json output, return an object. This assumes
 * that merlin's protocol is line-based (results are json objects rendered
 * on a single line).
 */
function runSingleCommand(process: child_process$ChildProcess, command: mixed): Promise<Object> {
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
        logger.error('Ocamlmerlin raised an error: ' + line);
        reject(Error('Ocamlmerlin returned an error'));
        return;
      }

      resolve(content);
    });

    stdin.write(commandString);
  });
}
