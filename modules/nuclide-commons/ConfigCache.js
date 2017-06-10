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

import type {LRUCache} from 'lru-cache';
import type {NuclideUri} from './nuclideUri';

import LRU from 'lru-cache';
import fsPromise from './fsPromise';

export class ConfigCache {
  _configFileName: string;
  _configCache: LRUCache<NuclideUri, Promise<?NuclideUri>>;

  constructor(configFileName: string) {
    this._configFileName = configFileName;
    this._configCache = LRU({
      max: 200, // Want this to exceed the maximum expected number of open files + dirs.
      maxAge: 1000 * 30, // 30 seconds
    });
  }

  getConfigDir(path: NuclideUri): Promise<?NuclideUri> {
    if (!this._configCache.has(path)) {
      const result = fsPromise.findNearestFile(this._configFileName, path);
      this._configCache.set(path, result);
      return result;
    }
    return this._configCache.get(path);
  }

  dispose(): void {
    this._configCache.reset();
  }
}
