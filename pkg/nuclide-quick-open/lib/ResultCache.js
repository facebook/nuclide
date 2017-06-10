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

import type {FileResult} from './types';
import type {ProviderResult} from './searchResultHelpers';

import invariant from 'assert';

import debounce from 'nuclide-commons/debounce';

// TODO use maps
type CachedDirectoryResults = {[query: string]: ProviderResult};
type CachedProviderResults = {[directory: string]: CachedDirectoryResults};
export type CachedResults = {[providerName: string]: CachedProviderResults};

// Number of elements in the cache before periodic cleanup kicks in. Includes partial query strings.
const MAX_CACHED_QUERIES = 100;
const CACHE_CLEAN_DEBOUNCE_DELAY = 5000;

export default class ResultCache {
  // Cache the last query with results for each provider.
  // Display cached results for the last completed query until new data arrives.
  _lastCachedQuery: Map<string, string>;
  // List of most recently used query strings, used for pruning the result cache.
  // Makes use of `Map`'s insertion ordering, so values are irrelevant and always set to `null`.
  _queryLruQueue: Map<string, ?number>;
  _cachedResults: CachedResults;
  _onResultsChanged: () => mixed;
  _debouncedCleanCache: () => void;

  constructor(onResultsChanged: () => mixed) {
    this._lastCachedQuery = new Map();
    this._queryLruQueue = new Map();
    this._cachedResults = {};
    this._onResultsChanged = onResultsChanged;
    this._debouncedCleanCache = debounce(
      () => this._cleanCache(),
      CACHE_CLEAN_DEBOUNCE_DELAY,
      /* immediate */ false,
    );
  }

  // Return value indicates whether there was a change
  removeResultsForProvider(providerName: string): void {
    if (this._cachedResults[providerName]) {
      delete this._cachedResults[providerName];
      this._onResultsChanged();
    }
    this._lastCachedQuery.delete(providerName);
  }

  setCacheResult(
    providerName: string,
    directory: string,
    query: string,
    results: Array<FileResult>,
    loading: boolean = false,
    error: ?Object = null,
  ): void {
    this._ensureCacheEntry(providerName, directory);
    this._cachedResults[providerName][directory][query] = {
      results,
      loading,
      error,
    };
    this._lastCachedQuery.set(providerName, query);
    // Refresh the usage for the current query.
    this._queryLruQueue.delete(query);
    this._queryLruQueue.set(query, null);
    setImmediate(this._debouncedCleanCache);
  }

  // Sets the cache result directly without modifying the _lastCachedQuery or _queryLruQueue.
  rawSetCacheResult(
    providerName: string,
    directory: string,
    query: string,
    result: ProviderResult,
  ): void {
    this._ensureCacheEntry(providerName, directory);
    this._cachedResults[providerName][directory][query] = result;
  }

  getCacheResult(
    providerName: string,
    directory: string,
    query: string,
  ): ProviderResult {
    this._ensureCacheEntry(providerName, directory);
    return this._cachedResults[providerName][directory][query];
  }

  // plz don't mutate this
  getAllCachedResults(): CachedResults {
    return this._cachedResults;
  }

  getLastCachedQuery(providerName: string): ?string {
    return this._lastCachedQuery.get(providerName);
  }

  setLastCachedQuery(providerName: string, query: string): void {
    this._lastCachedQuery.set(providerName, query);
  }

  _ensureCacheEntry(providerName: string, directory: string): void {
    if (!this._cachedResults[providerName]) {
      this._cachedResults[providerName] = {};
    }
    if (!this._cachedResults[providerName][directory]) {
      this._cachedResults[providerName][directory] = {};
    }
  }

  /**
   * Release the oldest cached results once the cache is full. Return value indicates whether the
   * cache was changed.
   */
  _cleanCache(): void {
    const queueSize = this._queryLruQueue.size;
    if (queueSize <= MAX_CACHED_QUERIES) {
      return;
    }
    // Figure out least recently used queries, and pop them off of the `_queryLruQueue` Map.
    const expiredQueries: Array<string> = [];
    const keyIterator = this._queryLruQueue.keys();
    const entriesToRemove = queueSize - MAX_CACHED_QUERIES;
    for (let i = 0; i < entriesToRemove; i++) {
      const firstEntryKey = keyIterator.next().value;
      invariant(firstEntryKey != null);
      expiredQueries.push(firstEntryKey);
      this._queryLruQueue.delete(firstEntryKey);
    }

    // For each (provider|directory) pair, remove results for all expired queries from the cache.
    for (const providerName in this._cachedResults) {
      for (const directory in this._cachedResults[providerName]) {
        const queryResults = this._cachedResults[providerName][directory];
        expiredQueries.forEach(query => delete queryResults[query]);
      }
    }
    this._onResultsChanged();
  }
}
