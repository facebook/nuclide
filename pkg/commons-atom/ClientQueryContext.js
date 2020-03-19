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

import type RecentFilesService from '../nuclide-recent-files-service/lib/RecentFilesService';
import type {WorkingSetsStore} from '../nuclide-working-sets/lib/types';

import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import uuid from 'uuid';

/**
 * The ClientQueryContext is used to improve ranking results in providers like
 * the FuzzyFileNameProvider.  It includes state information about Nuclide that
 * could inform which files or code the user might want to open next or search
 * within.
 */
export type ClientQueryContext = {
  session_id: string,
  open_arc_projects: Array<string>,
  working_sets: Array<string>,
  recent_files: Array<{path: string, timestamp: number}>,
};

const {
  findArcProjectIdAndDirectory,
  getCachedArcProjectIdAndDirectory,
} = (function() {
  try {
    // $FlowFB
    return require('./fb-arcanist');
  } catch (err) {
    return {};
  }
})();

/**
 * Hacky: consume these services directly.
 * It's rather annoying to have to thread these services through at the callsites.
 */
let workingSetsStore: ?WorkingSetsStore;
let recentFilesService: ?RecentFilesService;

atom.packages.serviceHub.consume('working-sets.provider', '0.0.0', store => {
  workingSetsStore = store;
  return new UniversalDisposable(() => {
    workingSetsStore = null;
  });
});

atom.packages.serviceHub.consume(
  'nuclide-recent-files-service',
  '0.0.0',
  service => {
    recentFilesService = service;
    return new UniversalDisposable(() => {
      recentFilesService = null;
    });
  },
);

export async function getNuclideContext(
  rootDirectory: string,
): Promise<?ClientQueryContext> {
  // If we don't have arcanist stuff available, we don't have complete context info.
  if (!findArcProjectIdAndDirectory || !getCachedArcProjectIdAndDirectory) {
    return null;
  }
  const arcInfo = await findArcProjectIdAndDirectory(rootDirectory);
  if (arcInfo == null) {
    return null;
  }
  const {directory} = arcInfo;
  const open_arc_projects = Array.from(
    new Set(
      atom.project
        .getPaths()
        .map(getCachedArcProjectIdAndDirectory)
        .filter(Boolean)
        .map(x => x.projectId),
    ),
  );
  const working_sets =
    workingSetsStore == null
      ? []
      : workingSetsStore
          .getCurrent()
          .getUris()
          .map(uri => {
            if (nuclideUri.contains(directory, uri)) {
              return nuclideUri.relative(directory, uri);
            }
          })
          .filter(Boolean);
  const RECENT_FILES_LIMIT = 100;
  const recent_files =
    recentFilesService == null
      ? []
      : (await recentFilesService.getRecentFiles())
          .map(({path, timestamp}) => {
            if (nuclideUri.contains(directory, path)) {
              return {
                path: nuclideUri.relative(directory, path),
                timestamp: Math.floor(timestamp / 1000),
              };
            }
          })
          .filter(Boolean)
          .slice(0, RECENT_FILES_LIMIT);
  return {
    session_id: uuid.v4(),
    open_arc_projects,
    working_sets,
    recent_files,
  };
}
