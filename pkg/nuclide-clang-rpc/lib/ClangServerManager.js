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

import type {ClangServerFlags} from './ClangServer';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import LRUCache from 'lru-cache';
import os from 'os';

import {serializeAsyncCall} from 'nuclide-commons/promise';
import {getLogger} from 'log4js';
import ClangFlagsManager from './ClangFlagsManager';
import ClangServer from './ClangServer';
import findClangServerArgs from './find-clang-server-args';

// Limit the number of active Clang servers.
const SERVER_LIMIT = 20;

// Limit the total memory usage of all Clang servers.
const MEMORY_LIMIT = Math.round(os.totalmem() * 15 / 100);

let _getDefaultFlags;
async function augmentDefaultFlags(
  src: string,
  flags: Array<string>,
): Promise<Array<string>> {
  if (_getDefaultFlags === undefined) {
    _getDefaultFlags = null;
    try {
      // $FlowFB
      _getDefaultFlags = require('./fb/custom-flags').getDefaultFlags;
    } catch (e) {
      // Open-source version
    }
  }
  if (_getDefaultFlags != null) {
    return flags.concat(await _getDefaultFlags(src));
  }
  return flags;
}

export default class ClangServerManager {
  _flagsManager: ClangFlagsManager;
  _servers: LRUCache<string, ClangServer>;
  _checkMemoryUsage: () => Promise<void>;

  constructor() {
    this._flagsManager = new ClangFlagsManager();
    this._servers = new LRUCache({
      max: SERVER_LIMIT,
      dispose(_, val: ClangServer) {
        val.dispose();
      },
    });
    // Avoid race conditions with simultaneous _checkMemoryUsage calls.
    this._checkMemoryUsage = serializeAsyncCall(
      this._checkMemoryUsageImpl.bind(this),
    );
  }

  getClangFlagsManager(): ClangFlagsManager {
    return this._flagsManager;
  }

  /**
   * Spawn one Clang server per translation unit (i.e. source file).
   * This allows working on multiple files at once, and simplifies per-file state handling.
   *
   * TODO(hansonw): We should ideally restart on change for all service requests.
   * However, restarting (and refetching flags) can take a very long time.
   * Currently, there's no "status" observable, so we can only provide a busy signal to the user
   * on diagnostic requests - and hence we only restart on 'compile' requests.
   */
  getClangServer(
    src: string,
    contents: string,
    compilationDBFile: ?NuclideUri,
    defaultFlags?: ?Array<string>,
    restartIfChanged?: boolean,
  ): ClangServer {
    let server = this._servers.get(src);
    if (server != null) {
      if (restartIfChanged && server.getFlagsChanged()) {
        this.reset(src);
      } else {
        return server;
      }
    }
    server = new ClangServer(
      src,
      contents,
      findClangServerArgs(src),
      this._getFlags(src, compilationDBFile, defaultFlags),
    );
    server.waitForReady().then(() => this._checkMemoryUsage());
    this._servers.set(src, server);
    return server;
  }

  // 1. Attempt to get flags from ClangFlagsManager.
  // 2. Otherwise, fall back to default flags.
  async _getFlags(
    src: string,
    compilationDBFile: ?NuclideUri,
    defaultFlags: ?Array<string>,
  ): Promise<?ClangServerFlags> {
    const flagsData = await this._flagsManager
      .getFlagsForSrc(src, compilationDBFile)
      .catch(e => {
        getLogger('nuclide-clang-rpc').error(
          `Error getting flags for ${src}:`,
          e,
        );
        return null;
      });
    if (flagsData != null && flagsData.flags != null) {
      return {
        flags: flagsData.flags,
        usesDefaultFlags: false,
        flagsFile: flagsData.flagsFile,
      };
    } else if (defaultFlags != null) {
      return {
        flags: await augmentDefaultFlags(src, defaultFlags),
        usesDefaultFlags: true,
        flagsFile: flagsData != null ? flagsData.flagsFile : null,
      };
    } else {
      return null;
    }
  }

  reset(src?: string): void {
    if (src != null) {
      this._servers.del(src);
    } else {
      this._servers.reset();
    }
    this._flagsManager.reset();
  }

  dispose() {
    this._servers.reset();
    this._flagsManager.reset();
  }

  async _checkMemoryUsageImpl(): Promise<void> {
    const usage = new Map();
    await Promise.all(
      this._servers.values().map(async server => {
        const mem = await server.getMemoryUsage();
        usage.set(server, mem);
      }),
    );

    // Servers may have been deleted in the meantime, so calculate the total now.
    let total = 0;
    let count = 0;
    this._servers.forEach(server => {
      const mem = usage.get(server);
      if (mem) {
        total += mem;
        count++;
      }
    });

    // Remove servers until we're under the memory limit.
    // Make sure we allow at least one server to stay alive.
    if (count > 1 && total > MEMORY_LIMIT) {
      const toDispose = [];
      this._servers.rforEach((server, key) => {
        const mem = usage.get(server);
        if (mem && count > 1 && total > MEMORY_LIMIT) {
          total -= mem;
          count--;
          toDispose.push(key);
        }
      });
      toDispose.forEach(key => this._servers.del(key));
    }
  }
}
