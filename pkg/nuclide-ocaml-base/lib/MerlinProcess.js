'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {NuclideUri} from '../../nuclide-remote-uri';
import type {MerlinError, MerlinType} from '..';

import path from 'path';
import readline from 'readline';

import {
  checkOutput,
  findNearestFile,
  safeSpawn,
  PromiseQueue,
} from '../../nuclide-commons';

const logger = require('../../nuclide-logging').getLogger();

const ERROR_RESPONSES = new Set([
  'failure',
  'error',
  'exception',
]);

/**
 * Wraps an ocamlmerlin process; provides api access to
 * ocamlmerlin's json-over-stdin/stdout protocol.
 *
 * This is based on the protocol description at:
 *   https://github.com/the-lambda-church/merlin/blob/master/doc/dev/PROTOCOL.md
 *   https://github.com/the-lambda-church/merlin/tree/master/src/frontend
 */
export class MerlinProcess {
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

  /**
   * Tell merlin where to find its per-repo .merlin config file.
   *
   * Configuration file format description:
   *   https://github.com/the-lambda-church/merlin/wiki/project-configuration
   *
   * @return a dummy cursor position on success
   */
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
  ): Promise<?{file: string; pos: {line: number; col: number}}> {
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

  /**
   * Run a command; parse the json output, return an object. This assumes
   * that merlin's protocol is line-based (results are json objects rendered
   * on a single line).
   */
  runSingleCommand(command: mixed): Promise<Object> {
    const commandString = JSON.stringify(command);
    const stdin = this._proc.stdin;
    const stdout = this._proc.stdout;

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

  dispose() {
    this._proc.kill();
  }
}

/**
 * @return A promise of an augmented environment variables with
 *   PATH that contains opam binary directory
 */
async function getEnvWithOpamBin(): Promise<String> {
  const ret = await checkOutput('opam', ['config', 'var', 'bin']);
  if (ret.exitCode === 0) {
    const env = {...process.env};
    env.PATH = `${env.PATH}${path.delimiter}${ret.stdout.trim()}`;
    return env;
  } else {
    logger.error('Cannot get opam bin');
    return process.env;
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

  const dotMerlinPath = await findNearestFile('.merlin', file);
  const env = await getEnvWithOpamBin();
  const options = {
    cwd: (dotMerlinPath ? path.dirname(dotMerlinPath) : '.'),
    env: env,
  };

  logger.info('Spawning new ocamlmerlin process');
  const process = await safeSpawn(merlinPath, flags, options);
  merlinProcessInstance = new MerlinProcess(process);

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
    const env = await getEnvWithOpamBin();
    const options = {
      shell: true,
      env: env,
    };
    const result = await checkOutput('which', [merlinPath], options);
    isInstalledCache = result.exitCode === 0;
    if (!isInstalledCache) {
      logger.info('ocamlmerlin not installed');
    }
  }

  return isInstalledCache;
}
