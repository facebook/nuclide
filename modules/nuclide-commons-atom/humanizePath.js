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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import idx from 'idx';
import nuclideUri from 'nuclide-commons/nuclideUri';

/**
 * Format a path for display. After the path is humanized, it should no longer be treated like a
 * parsable, navigable path; it's just for display.
 *
 * Note that this (intentionally) provides different results based on the projects currently open in
 * Atom. If you have multiple directories open, the result will be prefixed with one of their names.
 * If you only have one, it won't.
 */
export default function humanizePath(
  path: NuclideUri,
  options: ?{
    isDirectory?: boolean,
    rootPaths?: Array<NuclideUri>,
  },
): string {
  const isDirectory = idx(options, _ => _.isDirectory);
  const rootPaths =
    idx(options, _ => _.rootPaths) ||
    atom.project.getDirectories().map(dir => dir.getPath());
  const normalized = normalizePath(path, isDirectory);
  let resolved;
  for (const rootPath of rootPaths) {
    const normalizedDir = nuclideUri.normalizeDir(rootPath);
    if (nuclideUri.contains(normalizedDir, normalized)) {
      resolved = normalized.substr(normalizedDir.length);
      const rootName = nuclideUri.basename(normalizedDir);
      // If the path is a root or there's more than one root, include the root's name.
      if (normalized === normalizedDir) {
        return nuclideUri.normalizeDir(rootName);
      }
      if (rootPaths.length > 1) {
        return nuclideUri.join(rootName, resolved);
      }
      return resolved;
    }
  }

  // It's not in one of the project directories so return the full (normalized)
  // path run through nuclideUriToDisplayString to remove nuclide:// etc.
  return nuclideUri.nuclideUriToDisplayString(normalized);
}

function normalizePath(path: NuclideUri, isDirectory_: ?boolean): NuclideUri {
  const isDirectory =
    isDirectory_ == null ? nuclideUri.endsWithSeparator(path) : isDirectory_;
  return isDirectory
    ? nuclideUri.normalizeDir(path)
    : nuclideUri.normalize(path);
}
