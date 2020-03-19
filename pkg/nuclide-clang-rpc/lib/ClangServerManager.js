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

import type {LRUCache as LRUCacheType} from 'lru-cache';
import type {ClangServerFlags} from './ClangServer';
import type {ClangRequestSettings, ClangServerSettings} from './rpc-types';

import LRUCache from 'lru-cache';
import os from 'os';

import {serializeAsyncCall} from 'nuclide-commons/promise';
import {memoryUsagePerPid} from 'nuclide-commons/process';
import {getLogger} from 'log4js';
import ClangFlagsManager from './ClangFlagsManager';
import ClangServer from './ClangServer';
import findClangServerArgs from './find-clang-server-args';

// Limit the number of active Clang servers.
const SERVER_LIMIT = 20;

// Limit the total memory usage of all Clang servers.
const DEFAULT_MEMORY_LIMIT = Math.round((os.totalmem() * 15) / 100);

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
  _servers: LRUCacheType<string, ClangServer>;
  _checkMemoryUsage: () => Promise<number>;
  _memoryLimit: number = DEFAULT_MEMORY_LIMIT;

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

  setMemoryLimit(percent: number) {
    this._memoryLimit = Math.round(Math.abs((os.totalmem() * percent) / 100));
    this._checkMemoryUsage();
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
    _requestSettings: ?ClangRequestSettings,
    _defaultSettings?: ClangServerSettings,
    restartIfChanged?: boolean,
  ): ClangServer {
    const requestSettings = _requestSettings || {
      compilationDatabase: null,
      projectRoot: null,
    };
    const defaultSettings = _defaultSettings || {
      libclangPath: null,
      defaultFlags: null,
    };
    let server = this._servers.get(src);
    if (server != null) {
      if (restartIfChanged && server.getFlagsChanged()) {
        this.reset(src);
      } else {
        return server;
      }
    }
    const compilationDB = requestSettings.compilationDatabase;
    server = new ClangServer(
      src,
      contents,
      findClangServerArgs(
        src,
        compilationDB == null ? null : compilationDB.libclangPath,
        defaultSettings.libclangPath,
      ),
      this._getFlags(src, requestSettings, defaultSettings),
    );
    server.waitForReady().then(() => this._checkMemoryUsage());
    this._servers.set(src, server);
    return server;
  }

  // 1. Attempt to get flags from ClangFlagsManager.
  // 2. Otherwise, fall back to default flags.
  async _getFlags(
    src: string,
    requestSettings: ClangRequestSettings,
    defaultSettings: ClangServerSettings,
  ): Promise<?ClangServerFlags> {
    const flagsData = await this._flagsManager
      .getFlagsForSrc(src, requestSettings)
      .catch(e => {
        getLogger('nuclide-clang-rpc').error(
          `Error getting flags for ${src}:`,
          e,
        );
        return null;
      });
    if (flagsData != null && flagsData.flags.length > 0) {
      // Flags length could be 0 if the clang provider wants us to watch the
      // flags file but doesn't have accurate flags (e.g. header-only libs).
      return {
        flags: flagsData.flags,
        usesDefaultFlags: false,
        flagsFile: flagsData.flagsFile,
      };
    } else if (defaultSettings.defaultFlags != null) {
      return {
        flags: await augmentDefaultFlags(src, defaultSettings.defaultFlags),
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

  async _checkMemoryUsageImpl(): Promise<number> {
    const serverPids = this._servers
      // $FlowFixMe Missing in typings
      .values()
      .map(server => server.getPID())
      .filter(Boolean);
    if (serverPids.length === 0) {
      return 0;
    }

    const usage = await memoryUsagePerPid(serverPids);
    let total = Array.from(usage.values()).reduce((a, b) => a + b, 0);

    // Remove servers until we're under the memory limit.
    // Make sure we allow at least one server to stay alive.
    let count = usage.size;
    if (count > 1 && total > this._memoryLimit) {
      const toDispose = [];
      // $FlowFixMe Missing in typings
      this._servers.rforEach((server, key) => {
        const mem = usage.get(server.getPID());
        if (mem != null && count > 1 && total > this._memoryLimit) {
          total -= mem;
          count--;
          toDispose.push(key);
        }
      });
      toDispose.forEach(key => this._servers.del(key));
    }

    return total;
  }
}
