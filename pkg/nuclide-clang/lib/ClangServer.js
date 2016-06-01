'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type ClangFlagsManager from './ClangFlagsManager';

import invariant from 'assert';
import path from 'path';
import split from 'split';

import {EventEmitter} from 'events';
import {asyncExecute, safeSpawn} from '../../commons-node/process';
import {serializeAsyncCall} from '../../commons-node/promise';
import {getLogger} from '../../nuclide-logging';
import findClangServerArgs from './find-clang-server-args';

// Mac OS X (El Capitan) prints this warning when loading the libclang library.
// It's not silenceable and has no effect, so just ignore it.
const DYLD_WARNING = 'dyld: warning, LC_RPATH';

const logger = getLogger();

let getDefaultFlags;
async function augmentDefaultFlags(src: string, flags: Array<string>): Promise<Array<string>> {
  if (getDefaultFlags === undefined) {
    getDefaultFlags = null;
    try {
      // $FlowFB
      getDefaultFlags = require('./fb/custom-flags').getDefaultFlags;
    } catch (e) {
      // Open-source version
    }
  }
  if (getDefaultFlags != null) {
    return flags.concat(await getDefaultFlags(src));
  }
  return flags;
}

type Connection = {
  dispose: () => any;
  process: child_process$ChildProcess;
  readableStream: stream$Readable;
  writableStream: stream$Writable;
};

// List of supported methods. Keep in sync with the Python server.
type ClangServerRequest =
  'compile' | 'get_completions' | 'get_declaration' | 'get_declaration_info' |
  'get_outline';

export default class ClangServer {

  _src: string;
  _clangFlagsManager: ClangFlagsManager;
  _emitter: EventEmitter;
  _nextRequestId: number;
  _lastProcessedRequestId: number;
  _asyncConnection: ?Connection;
  _pendingCompileRequests: number;
  _getAsyncConnection: () => Promise<?Connection>;
  _disposed: boolean;

  // Cache the flags-fetching promise so we don't end up invoking Buck twice.
  _flagsPromise: ?Promise<?Array<string>>;

  // Detect when flags have changed so we can alert the client.
  _flagsChanged: boolean;
  _flagsChangedSubscription: ?rx$ISubscription;

  constructor(clangFlagsManager: ClangFlagsManager, src: string) {
    this._src = src;
    this._clangFlagsManager = clangFlagsManager;
    this._emitter = new EventEmitter();
    this._nextRequestId = 0;
    this._lastProcessedRequestId = -1;
    this._pendingCompileRequests = 0;
    this._getAsyncConnection = serializeAsyncCall(this._getAsyncConnectionImpl.bind(this));
    this._disposed = false;
    this._flagsChanged = false;
    this._flagsChangedSubscription = null;
  }

  dispose() {
    this._disposed = true;
    this._cleanup();
  }

  /**
   * Returns RSS of the child process in bytes.
   * Works on Unix and Mac OS X.
   */
  async getMemoryUsage(): Promise<number> {
    if (this._asyncConnection == null) {
      return 0;
    }
    const {exitCode, stdout} = await asyncExecute(
      'ps',
      ['-p', this._asyncConnection.process.pid.toString(), '-o', 'rss='],
    );
    if (exitCode !== 0) {
      return 0;
    }
    return parseInt(stdout, 10) * 1024; // ps returns KB
  }

  _cleanup() {
    // Fail all pending requests.
    // The Clang server receives requests serially via stdin (and processes them in that order)
    // so it's quite safe to assume that requests are processed in order.
    for (let reqid = this._lastProcessedRequestId + 1; reqid < this._nextRequestId; reqid++) {
      this._emitter.emit(reqid.toString(), {error: 'Server was killed.'});
    }
    if (this._asyncConnection) {
      this._asyncConnection.dispose();
    }
    this._emitter.removeAllListeners();
    if (this._flagsChangedSubscription != null) {
      this._flagsChangedSubscription.unsubscribe();
      this._flagsChangedSubscription = null;
    }
  }

  getFlags(): Promise<?Array<string>> {
    if (this._flagsPromise != null) {
      return this._flagsPromise;
    }
    this._flagsPromise = this._clangFlagsManager.getFlagsForSrc(this._src)
      .then(result => {
        if (result) {
          this._flagsChangedSubscription = result.changes.subscribe(() => {
            this._flagsChanged = true;
          }, () => {
            // Will be automatically unsubscribed here.
            this._flagsChangedSubscription = null;
          });
          return result.flags;
        }
        return null;
      }, e => {
        logger.error(`clang-server: Could not get flags for ${this._src}`, e);
      });
    return this._flagsPromise;
  }

  getFlagsChanged(): boolean {
    return this._flagsChanged;
  }

  /**
   * Send a request to the Clang server.
   * Requests are processed serially and strictly in order.
   * If the server is currently compiling, all other requests will automatically return null
   * (unless the `blocking` parameter is explicitly provided).
   */
  async makeRequest(
    method: ClangServerRequest,
    defaultFlags: ?Array<string>,
    params: Object,
    blocking?: boolean,
  ): Promise<any> {
    invariant(!this._disposed, 'calling makeRequest on a disposed ClangServer');
    if (method === 'compile') {
      this._pendingCompileRequests++;
    } else if (!blocking && this._pendingCompileRequests) {
      // All non-blocking requests should instantly fail.
      // This allows the client to fall back to default autocomplete, ctags, etc.
      return null;
    }
    try {
      return await this._makeRequestImpl(method, defaultFlags, params);
    } finally {
      if (method === 'compile') {
        this._pendingCompileRequests--;
      }
    }
  }

  async _makeRequestImpl(
    method: ClangServerRequest,
    defaultFlags: ?Array<string>,
    params: Object,
  ): Promise<any> {
    let flags = await this.getFlags();
    let accurateFlags = true;
    if (flags == null) {
      if (defaultFlags == null) {
        return null;
      }
      flags = await augmentDefaultFlags(this._src, defaultFlags);
      accurateFlags = false;
    }

    const connection = await this._getAsyncConnection();
    if (connection == null) {
      return null;
    }

    const reqid = this._getNextRequestId();
    const request = {id: reqid, args: {method, flags, ...params}};
    const logData = JSON.stringify(request, (key, value) => {
      // File contents are too large and clutter up the logs, so exclude them.
      // We generally only want to see the flags for 'compile' commands, since they'll usually
      // be the same for all other commands (barring an unexpected restart).
      if (key === 'contents' || (method !== 'compile' && key === 'flags')) {
        return undefined;
      } else {
        return value;
      }
    });

    logger.debug('LibClang request: ' + logData);
    // Because Node uses an event-loop, we do not have to worry about a call to
    // write() coming in from another thread between our two calls here.
    const {writableStream} = connection;
    writableStream.write(JSON.stringify(request));
    writableStream.write('\n');

    return new Promise((resolve, reject) => {
      this._emitter.once(reqid, response => {
        logger.debug('LibClang response: ' + JSON.stringify(response));
        this._lastProcessedRequestId = parseInt(reqid, 10);
        if (response.error && !this._disposed) {
          logger.error('error received from clang_server.py for request:',
            logData,
            response.error);
          reject(response.error);
        } else {
          const {result} = response;
          if (method === 'compile') {
            // Using default flags typically results in poor diagnostics, so let the caller know.
            result.accurateFlags = accurateFlags;
          }
          resolve(result);
        }
      });
    });
  }

  _getNextRequestId(): string {
    return (this._nextRequestId++).toString();
  }

  async _getAsyncConnectionImpl(): Promise<?Connection> {
    if (this._asyncConnection == null) {
      try {
        const connection = await this.createAsyncConnection(this._src);
        connection.readableStream
          .pipe(split(JSON.parse))
          .on('data', response => {
            const id = response['id'];
            this._emitter.emit(id, response);
          })
          .on('error', error => {
            if (!this._disposed) {
              logger.error(
                'Failed to handle libclang output, most likely the libclang python'
                + ' server crashed.',
                error,
              );
              this._cleanup();
            }
            this._asyncConnection = null;
            this._lastProcessedRequestId = this._nextRequestId - 1;
          });
        this._asyncConnection = connection;
      } catch (e) {
        logger.error('Could not connect to Clang server', e);
      }
    }
    return this._asyncConnection;
  }

  async createAsyncConnection(src: string): Promise<Connection> {
    return await new Promise(async (resolve, reject) => {
      const {libClangLibraryFile, pythonPathEnv, pythonExecutable} = await findClangServerArgs();
      const pathToLibClangServer = path.join(__dirname, '../python/clang_server.py');
      const env: any = {
        PYTHONPATH: pythonPathEnv,
      };
      const args = [pathToLibClangServer, src];
      if (libClangLibraryFile != null) {
        args.push('--libclang-file', libClangLibraryFile);
      }
      const options = {
        cwd: path.dirname(pathToLibClangServer),
        // The process should use its ordinary stderr for errors.
        stdio: 'pipe',
        detached: false, // When Atom is killed, clang_server.py should be killed, too.
        env,
      };

      // Note that safeSpawn() often overrides options.env.PATH, but that only happens when
      // options.env is undefined (which is not the case here). This will only be an issue if the
      // system cannot find `pythonExecutable`.
      const child = await safeSpawn(pythonExecutable, args, options);

      child.on('close', exitCode => {
        if (!this._disposed) {
          logger.error(`${pathToLibClangServer} exited with code ${exitCode}`);
        }
      });
      child.stderr.on('data', error => {
        if (error instanceof Buffer) {
          error = error.toString('utf8');
        }
        if (error.indexOf(DYLD_WARNING) === -1) {
          logger.error('Error receiving data', error);
        }
      });
      const writableStream = child.stdin;
      writableStream.on('error', error => {
        logger.error('Error writing data', error);
      });

      let childRunning = true;
      child.on('exit', () => {
        childRunning = false;
      });
      resolve({
        dispose: () => {
          if (childRunning) {
            child.kill();
            childRunning = false;
          }
        },
        process: child,
        readableStream: child.stdout,
        writableStream,
      });
    });
  }

}
