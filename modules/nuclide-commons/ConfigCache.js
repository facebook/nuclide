/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {LRUCache} from 'lru-cache';
import type {NuclideUri} from './nuclideUri';

import LRU from 'lru-cache';
import fsPromise from './fsPromise';

export class ConfigCache {
  _configFileNames: Array<string>;
  _configCache: LRUCache<NuclideUri, Promise<?NuclideUri>>;

  constructor(configFileNames: Array<string>) {
    this._configFileNames = configFileNames;
    this._configCache = LRU({
      max: 200, // Want this to exceed the maximum expected number of open files + dirs.
      maxAge: 1000 * 30, // 30 seconds
    });
  }

  getConfigDir(path: NuclideUri): Promise<?NuclideUri> {
    let result = this._configCache.get(path);
    if (result == null) {
      result = this._findConfigDir(path);
      this._configCache.set(path, result);
    }
    return result;
  }

  async _findConfigDir(path: NuclideUri): Promise<?NuclideUri> {
    const configDirs = await Promise.all(
      this._configFileNames.map(configFile =>
        fsPromise.findNearestFile(configFile, path),
      ),
    );
    // Find the result with the greatest length (the closest match).
    return configDirs.filter(Boolean).reduce((previous, configDir) => {
      if (previous == null || configDir.length > previous.length) {
        return configDir;
      }
      return previous;
    }, null);
  }

  dispose(): void {
    this._configCache.reset();
  }
}
