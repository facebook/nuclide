/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {LRUCache} from 'lru-cache';
import type {NuclideUri} from './nuclideUri';

import LRU from 'lru-cache';
import {findSubArrayIndex} from './collection';
import fsPromise from './fsPromise';
import nuclideUri from './nuclideUri';

export type SearchStrategy =
  | 'nearest'
  | 'aurora'
  | 'eclipse'
  | 'ocaml'
  | 'thrift';

export class ConfigCache {
  _configPatterns: Array<string>;
  _searchStrategy: SearchStrategy;
  _configCache: LRUCache<NuclideUri, Promise<?NuclideUri>>;

  constructor(
    configPatterns: Array<string>,
    searchStrategy?: SearchStrategy = 'nearest',
  ) {
    this._configPatterns = configPatterns;
    this._searchStrategy = searchStrategy;
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
    if (this._searchStrategy === 'eclipse') {
      const configDirs = await Promise.all(
        this._configPatterns.map(configFile =>
          fsPromise.findFurthestFile(configFile, path),
        ),
      );
      return configDirs.filter(Boolean).reduce((previous, configDir) => {
        if (previous == null || configDir.length < previous.length) {
          return configDir;
        }
        return previous;
      }, null);
    } else if (this._searchStrategy === 'thrift') {
      // Find the first occurrence of a config segment in the path.
      const pathSplit = nuclideUri.split(path);
      return this._configPatterns
        .map(configPattern => {
          const configSplit = nuclideUri.split(configPattern);
          const foundIndex = findSubArrayIndex(pathSplit, configSplit);
          return foundIndex !== -1
            ? nuclideUri.join(
                ...pathSplit.slice(0, foundIndex + configSplit.length),
              )
            : null;
        })
        .find(Boolean);
    } else if (this._searchStrategy === 'ocaml') {
      // ocaml-language-server (the LSP server) is the same single LSP server binary
      // for all ocaml projects and for all versions of merlin.
      //
      // It uses initializationOptions.path.ocamlmerlin from the initialize request
      // (or just the string "ocamlmerlin" if that was absent) to determine what
      // command to use for spawning merlin. (merlin itself has no notion of project root).
      //
      // It also uses projectRoot, but solely to customize which merlin binary to launch:
      // if it finds projectRoot/node_modules/.cache/_esy/build/bin/command-exec[.bat]
      // then it will launch "command-exec <ocamlmerlin>"; otherwise it just launches <ocamlmerlin>
      // using projectRoot as the current working directory.
      //
      // Therefore: to find project root for a given file, we'll either use the nearest
      // containing parent such that directory parent/node_modules/.cache/_esy/build/bin exists,
      // or "/" otherwise.

      let dir = nuclideUri.dirname(path);
      while (true) {
        const wrapper = nuclideUri.join(
          dir,
          'node_modules',
          '.cache',
          '_esy',
          'build',
          'bin',
        );
        // eslint-disable-next-line no-await-in-loop
        if (await fsPromise.exists(wrapper)) {
          return dir;
        } else if (nuclideUri.isRoot(dir)) {
          return dir;
        } else {
          dir = nuclideUri.dirname(dir);
        }
      }
    } else if (this._searchStrategy === 'aurora') {
      const candidateDir = await fsPromise.findNearestFile('.hhconfig', path);
      if (
        candidateDir != null &&
        (await fsPromise.exists(nuclideUri.join(candidateDir, '.arcconfig')))
      ) {
        return candidateDir;
      }
      return null;
    } else {
      (this._searchStrategy: 'nearest');
      // Find the result with the greatest length (the closest match).
      const configDirs = await Promise.all(
        this._configPatterns.map(configFile =>
          fsPromise.findNearestFile(configFile, path),
        ),
      );
      return configDirs.filter(Boolean).reduce((previous, configDir) => {
        if (previous == null || configDir.length > previous.length) {
          return configDir;
        }
        return previous;
      }, null);
    }
  }

  dispose(): void {
    this._configCache.reset();
  }
}
