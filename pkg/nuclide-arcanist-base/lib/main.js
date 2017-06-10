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

/* global localStorage */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import LRUCache from 'lru-cache';
import {getArcanistServiceByNuclideUri} from '../../nuclide-remote-connection';

export type ArcProjectInfo = {
  projectId: string,
  directory: NuclideUri,
};

const arcInfoCache: LRUCache<string, Promise<?ArcProjectInfo>> = new LRUCache({
  max: 200,
});
const arcInfoResultCache: LRUCache<string, ?ArcProjectInfo> = new LRUCache({
  max: 200,
});
const STORAGE_KEY = 'nuclide.last-arc-project-path';

/**
 * Cached wrapper around ArcanistService.findArcProjectIdAndDirectory.
 * The service also caches this, but since this is called so frequently we should
 * try to avoid going over the RPC layer as well.
 */
export function findArcProjectIdAndDirectory(
  src: string,
): Promise<?ArcProjectInfo> {
  let cached = arcInfoCache.get(src);
  if (cached == null) {
    const arcService = getArcanistServiceByNuclideUri(src);
    cached = arcService
      .findArcProjectIdAndDirectory(src)
      .then(result => {
        // Store the path in local storage for `getLastProjectPath`.
        if (result != null) {
          localStorage.setItem(
            `${STORAGE_KEY}.${result.projectId}`,
            result.directory,
          );
        }
        arcInfoResultCache.set(src, result);
        return result;
      })
      .catch(err => {
        // Clear the cache if there's an error to enable retries.
        arcInfoCache.del(src);
        return Promise.reject(err);
      });
    arcInfoCache.set(src, cached);
  }
  return cached;
}

/**
 * A best-effort function that only works if findArcProjectIdAndDirectory
 * has completed at some point in the past.
 * This is actually the common case due to its ubiquity.
 */
export function getCachedArcProjectIdAndDirectory(
  src: string,
): ?ArcProjectInfo {
  return arcInfoResultCache.get(src);
}

export function getLastProjectPath(projectId: string): ?string {
  return localStorage.getItem(`${STORAGE_KEY}.${projectId}`);
}
