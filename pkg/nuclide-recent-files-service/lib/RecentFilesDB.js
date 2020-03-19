/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */
import type {FilePath, TimeStamp} from '..';
import type {LRUCache as LRUCacheType} from 'lru-cache';

import {memoize} from 'lodash';
import {getLogger} from 'log4js';
import LRUCache from 'lru-cache';
import AsyncStorage from 'idb-keyval';
import debounce from 'nuclide-commons/debounce';

const MAX_RECENT_FILES = 100;
const SYNC_CACHE_DEBOUNCE = 1000 * 15;
const RECENT_FILES_DB_NAME = 'nuclide-recent-files';

const logger = getLogger('RecentFilesDB');

/**
 * We don't want to keep making IDB calls for performance reasons, and we only
 * care about tracking MAX_RECENT_FILES files.  So, we keep the LRU cached
 * locally and load from the database the first time we need to access it, and
 * save back to the database (only the top 100) periodically.
 */
const ensureCache = memoize(
  async (): Promise<LRUCacheType<FilePath, TimeStamp>> => {
    const dbEntries = await AsyncStorage.get(RECENT_FILES_DB_NAME).catch(
      err => {
        logger.warn('Error retrieving recent files from IndexedDB', err);
        return null;
      },
    );
    const cachedLRU = LRUCache({max: MAX_RECENT_FILES});
    if (dbEntries && dbEntries.length > 0) {
      cachedLRU.load(dbEntries);
    }
    return cachedLRU;
  },
);

/**
 * Update the timestamp for a file in the list of LRU files that is backed by
 * the database.
 */
export async function touchFileDB(
  path: FilePath,
  time: TimeStamp,
): Promise<void> {
  (await ensureCache()).set(path, time);
  debouncedSyncCache();
}

/**
 * Get the LRU files.
 */
export async function getAllRecents(): Promise<
  LRUCacheType<FilePath, TimeStamp>,
> {
  return ensureCache();
}

/**
 * Save the LRU files back to the stable store.
 * With clearCache = true, clears the local cache.
 */
export async function syncCache(clearCache: boolean = false): Promise<void> {
  const cachedLRU = await ensureCache();
  // This technically saves the "value" as a serialized json, but it will only
  // be up to MAX_RECENT_FILES long.
  await AsyncStorage.set(RECENT_FILES_DB_NAME, cachedLRU.dump()).catch(err =>
    logger.warn('Error in syncCache', err),
  );
  if (clearCache) {
    ensureCache.cache.clear();
  }
}

const debouncedSyncCache = debounce(syncCache, SYNC_CACHE_DEBOUNCE);
