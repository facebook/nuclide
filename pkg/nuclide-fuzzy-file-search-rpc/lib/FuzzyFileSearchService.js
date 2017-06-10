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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {FileSearchResult} from './rpc-types';

import {
  fileSearchForDirectory,
  getExistingSearchDirectories,
  disposeSearchForDirectory,
} from './FileSearchProcess';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';

/**
 * Performs a fuzzy file search in the specified directory.
 */
export async function queryFuzzyFile(
  rootDirectory: NuclideUri,
  queryString: string,
  ignoredNames: Array<string>,
): Promise<Array<FileSearchResult>> {
  // Note that Eden makes a "magical" .eden directory entry stat'able but not readdir'able in every
  // directory under EdenFS to make it cheap to check whether a directory is in EdenFS.
  const pathToDotEden = nuclideUri.join(rootDirectory, '.eden');
  const isEden = await fsPromise.isNonNfsDirectory(pathToDotEden);
  if (!isEden) {
    const search = await fileSearchForDirectory(rootDirectory, ignoredNames);
    return search.query(queryString);
  } else {
    const edenFsRoot = await fsPromise.readlink(
      nuclideUri.join(pathToDotEden, 'root'),
    );
    // $FlowFB
    const {doSearch} = require('./fb-EdenFileSearch');
    return doSearch(queryString, edenFsRoot, rootDirectory);
  }
}

export async function queryAllExistingFuzzyFile(
  queryString: string,
  ignoredNames: Array<string>,
): Promise<Array<FileSearchResult>> {
  const directories = getExistingSearchDirectories();
  const aggregateResults = await Promise.all(
    directories.map(rootDirectory =>
      queryFuzzyFile(rootDirectory, queryString, ignoredNames),
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
