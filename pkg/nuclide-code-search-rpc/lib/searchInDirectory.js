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

import type {
  CodeSearchResult,
  CodeSearchTool,
  DirectoryCodeSearchParams,
} from './types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {Minimatch} from 'minimatch';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';
import {searchWithTool, resolveTool} from './searchTools';
import {search as vcsSearch} from './VcsSearchHandler';

export function searchInDirectory(
  tool: ?CodeSearchTool,
  useVcsSearch: boolean,
  params: DirectoryCodeSearchParams,
): Observable<CodeSearchResult> {
  return useVcsSearch
    ? vcsSearch(params).catch(() => searchWithTool(tool, params))
    : searchWithTool(tool, params);
}

export function searchInDirectories(
  subdirs: Array<NuclideUri>,
  tool: ?CodeSearchTool,
  useVcsSearch: boolean,
  options: DirectoryCodeSearchParams,
): Observable<CodeSearchResult> {
  const {directory} = options;
  // Resolve tool once here so we do not call 'which' for each subdir.
  return Observable.defer(() => resolveTool(tool)).switchMap(actualTool => {
    if (!subdirs || subdirs.length === 0) {
      // Since no subdirs were specified, run search on the root directory.
      return searchInDirectory(tool, useVcsSearch, options);
    } else if (subdirs.find(subdir => subdir.includes('*'))) {
      // Mimic Atom and use minimatch for glob matching.
      const matchers = subdirs.map(subdir => {
        let pattern = subdir;
        if (!pattern.includes('*')) {
          // Automatically glob-ify the non-globs.
          pattern = nuclideUri.ensureTrailingSeparator(pattern) + '**';
        }
        return new Minimatch(pattern, {matchBase: true, dot: true});
      });
      // TODO: This should walk the subdirectories and filter by glob before searching.
      return searchInDirectory(tool, useVcsSearch, options).filter(result =>
        Boolean(matchers.find(matcher => matcher.match(result.file))),
      );
    } else {
      // Run the search on each subdirectory that exists.
      return Observable.from(subdirs)
        .concatMap(async subdir => {
          try {
            const stat = await fsPromise.lstat(
              nuclideUri.join(directory, subdir),
            );
            if (stat.isDirectory()) {
              return searchInDirectory(tool, useVcsSearch, {
                ...options,
                directory: nuclideUri.join(directory, subdir),
              });
            } else {
              return Observable.empty();
            }
          } catch (e) {
            return Observable.empty();
          }
        })
        .mergeAll();
    }
  });
}
