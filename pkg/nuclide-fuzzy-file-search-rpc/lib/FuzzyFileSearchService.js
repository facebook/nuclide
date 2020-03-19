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
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {DirectorySearchConfig, FileSearchResult} from './rpc-types';
import type {ClientQueryContext} from '../../commons-atom/ClientQueryContext';

import LRU from 'lru-cache';
import {trackTiming} from 'nuclide-analytics';
import {
  fileSearchForDirectory,
  getExistingSearchDirectories,
  disposeSearchForDirectory,
} from './FileSearchProcess';
import fsPromise from 'nuclide-commons/fsPromise';
import {getLogger} from 'log4js';

type CacheKey = string;

function createCacheKey(
  directory: NuclideUri,
  preferCustomSearch: boolean,
): CacheKey {
  return `${directory}:${String(preferCustomSearch)}`;
}

const searchConfigCache: LRUCache<
  CacheKey,
  Promise<DirectorySearchConfig>,
> = LRU({
  // In practice, we expect this cache to have one entry for each item in
  // `atom.project.getPaths()`. We do not expect this number to be particularly
  // large, so we add a bit of a buffer and log an error if we actually fill the
  // cache.
  max: 25,
  dispose(key: NuclideUri, value: Promise<DirectorySearchConfig>) {
    getLogger('FuzzyFileSearchService').error(
      `Unexpected eviction of ${key} from the searchConfigCache.`,
    );
  },
});

const getSearchConfig = (function() {
  try {
    // $FlowFB
    return require('./fb-custom-file-search').getSearchConfig;
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }

    return function(
      directory: NuclideUri,
      preferCustomSearch: boolean,
    ): Promise<DirectorySearchConfig> {
      return Promise.resolve({useCustomSearch: false});
    };
  }
})();

/**
 * Performs a fuzzy file search in the specified directory.
 */
export async function queryFuzzyFile(config: {|
  rootDirectory: NuclideUri,
  queryRoot?: NuclideUri,
  queryString: string,
  ignoredNames: Array<string>,
  smartCase?: boolean,
  preferCustomSearch: boolean,
  context: ?ClientQueryContext,
|}): Promise<Array<FileSearchResult>> {
  const {rootDirectory, preferCustomSearch} = config;
  const cacheKey = createCacheKey(rootDirectory, preferCustomSearch);
  let searchConfigPromise = searchConfigCache.get(cacheKey);
  if (searchConfigPromise == null) {
    searchConfigPromise = getSearchConfig(rootDirectory, preferCustomSearch);
    searchConfigCache.set(cacheKey, searchConfigPromise);
  }

  const searchConfig = await searchConfigPromise;
  return trackTiming(
    'fuzzy-file-search',
    async () => {
      if (searchConfig.useCustomSearch) {
        return searchConfig.search(
          config.queryString,
          rootDirectory,
          config.context,
        );
      } else {
        const search = await fileSearchForDirectory(
          rootDirectory,
          config.ignoredNames,
        );
        return search.query(config.queryString, {
          queryRoot: config.queryRoot,
          smartCase: config.smartCase,
        });
      }
    },
    {
      path: rootDirectory,
      useCustomSearch: searchConfig.useCustomSearch,
    },
  );
}

export async function queryAllExistingFuzzyFile(
  queryString: string,
  ignoredNames: Array<string>,
  preferCustomSearch: boolean,
  context: ?ClientQueryContext,
): Promise<Array<FileSearchResult>> {
  const directories = getExistingSearchDirectories();
  const aggregateResults = await Promise.all(
    directories.map(rootDirectory =>
      queryFuzzyFile({
        ignoredNames,
        queryString,
        rootDirectory,
        preferCustomSearch,
        context,
      }),
    ),
  );
  // Optimize for the common case.
  if (aggregateResults.length === 1) {
    return aggregateResults[0];
  } else {
    return [].concat(...aggregateResults).sort((a, b) => b.score - a.score);
  }
}

/**
 * @return whether this service can perform fuzzy file queries on the
 *   specified directory.
 */
export function isFuzzySearchAvailableFor(
  rootDirectory: NuclideUri,
): Promise<boolean> {
  return fsPromise.exists(rootDirectory);
}

/**
 * This should be called when the directory is removed from Atom.
 */
export function disposeFuzzySearch(rootDirectory: NuclideUri): Promise<void> {
  return disposeSearchForDirectory(rootDirectory);
}
