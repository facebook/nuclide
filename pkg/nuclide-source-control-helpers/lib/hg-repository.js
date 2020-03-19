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

import nuclideUri from 'nuclide-commons/nuclideUri';
import ini from 'ini';
import fs from 'fs';

import type {HgRepositoryDescription} from './types';

/**
 * This function returns HgRepositoryDescription filled with a repoPath and
 * originURL iff it finds that the given directory is within an Hg repository.
 */
export default function findHgRepository(
  startDirectoryPath: string,
): ?HgRepositoryDescription {
  if (!nuclideUri.isLocal(startDirectoryPath)) {
    return null;
  }
  let workingDirectoryPath = startDirectoryPath;
  for (;;) {
    const repoPath = nuclideUri.join(workingDirectoryPath, '.hg');
    if (tryIsDirectorySync(repoPath)) {
      let originURL = null;
      // Note that .hg/hgrc will not exist in a local repo created via `hg init`, for example.
      const hgrc = tryReadFileSync(nuclideUri.join(repoPath, 'hgrc'));
      if (hgrc != null) {
        const config = ini.parse(hgrc);
        if (
          typeof config.paths === 'object' &&
          typeof config.paths.default === 'string'
        ) {
          originURL = config.paths.default;
        }
      }
      return {repoPath, originURL, workingDirectoryPath};
    }
    const parentDir = nuclideUri.dirname(workingDirectoryPath);
    if (parentDir === workingDirectoryPath) {
      return null;
    } else {
      workingDirectoryPath = parentDir;
    }
  }
}

function tryIsDirectorySync(dirname) {
  try {
    const stat = fs.statSync(dirname);
    return stat.isDirectory();
  } catch (err) {
    return false;
  }
}

function tryReadFileSync(filename) {
  try {
    return fs.readFileSync(filename, 'utf8');
  } catch (err) {
    return null;
  }
}
