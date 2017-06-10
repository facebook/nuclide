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

import type {FileSearchResult} from '../rpc-types';

import os from 'os';
import {makeRe} from 'minimatch';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Matcher} from '../../../nuclide-fuzzy-native';

export class PathSet {
  _matcher: Matcher;
  _ignoredPatterns: Array<RegExp>;
  _rootPath: string;

  /**
   * To improve working with multiple active directories, include the basename
   * of the parent directory in the matched filenames.
   * This class will invisibly add/strip the basename as necessary.
   */
  _basename: string;

  constructor(
    paths: Array<string>,
    ignoredNames: Array<string>,
    rootPath: string,
  ) {
    this._ignoredPatterns = ignoredNames
      .map(name => makeRe(name, {matchBase: true, dot: true}))
      // makeRe returns false for invalid patterns.
      .filter(x => x);
    this._rootPath = rootPath;
    this._basename = nuclideUri.basename(rootPath);
    this._matcher = new Matcher(this._transformPaths(paths));
  }

  addPaths(paths: Array<string>) {
    this._matcher.addCandidates(this._transformPaths(paths));
  }

  removePaths(paths: Array<string>) {
    this._matcher.removeCandidates(this._transformPaths(paths));
  }

  query(query: string): Array<FileSearchResult> {
    // Attempt to relativize paths that people might e.g. copy + paste.
    let relQuery = query;
    // Remove the leading home directory qualifier.
    if (relQuery.startsWith('~/')) {
      relQuery = relQuery.substr(2);
    }
    // If a full path is pasted, make the path relative.
    const rootPath = nuclideUri.ensureTrailingSeparator(this._rootPath);
    const basePath = nuclideUri.ensureTrailingSeparator(
      nuclideUri.dirname(rootPath),
    );
    if (relQuery.startsWith(rootPath)) {
      relQuery = relQuery.substr(rootPath.length);
    }

    return (
      this._matcher
        .match(relQuery, {
          maxResults: 20,
          numThreads: os.cpus().length,
          recordMatchIndexes: true,
        })
        // Expand the search results to the full path.
        .map(result => {
          let {matchIndexes} = result;
          if (matchIndexes != null) {
            matchIndexes = matchIndexes
              .map(idx => idx + basePath.length)
              // Discard all matching characters in the basepath.
              // It can be a little confusing when the highlights don't match, but unless
              // the basename is explicitly used in the query this usually doesn't happen.
              .filter(idx => idx >= rootPath.length);
          }
          return {
            score: result.score,
            path: basePath + result.value,
            matchIndexes: matchIndexes || [],
          };
        })
    );
  }

  _isIgnored(path: string): boolean {
    // This is 2x as fast as using Array.some...
    for (let i = 0; i < this._ignoredPatterns.length; i++) {
      if (this._ignoredPatterns[i].test(path)) {
        return true;
      }
    }
    return false;
  }

  // Append the basename to paths in the index.
  _transformPaths(paths: Array<string>): Array<string> {
    return paths
      .filter(path => !this._isIgnored(path))
      .map(path => nuclideUri.join(this._basename, path));
  }
}
