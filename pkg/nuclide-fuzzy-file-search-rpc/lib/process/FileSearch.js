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

import fsPromise from 'nuclide-commons/fsPromise';
import {getLogger} from 'log4js';

import {PathSet} from './PathSet';
import {getPaths} from './PathSetFactory';
import PathSetUpdater from './PathSetUpdater';

const logger = getLogger('nuclide-fuzzy-file-search-rpc');

const fileSearchCache = {};

export async function fileSearchForDirectory(
  directory: string,
  pathSetUpdater: ?PathSetUpdater,
  ignoredNames?: Array<string> = [],
): Promise<PathSet> {
  // Note: races are not an issue here since initialization is managed in
  // FileSearchProcess (which protects against simultaneous inits).
  const cached = fileSearchCache[directory];
  if (cached) {
    return cached;
  }

  const realpath = await fsPromise.realpath(directory);
  const paths = await getPaths(realpath);
  const pathSet = new PathSet(paths, ignoredNames || [], directory);

  const thisPathSetUpdater = pathSetUpdater || getPathSetUpdater();
  try {
    await thisPathSetUpdater.startUpdatingPathSet(pathSet, realpath);
  } catch (e) {
    logger.warn(
      `Could not update path sets for ${realpath}. Searches may be stale`,
      e,
    );
    // TODO(hansonw): Fall back to manual refresh or node watches
  }

  fileSearchCache[directory] = pathSet;
  return pathSet;
}

let pathSetUpdater;

function getPathSetUpdater() {
  if (!pathSetUpdater) {
    pathSetUpdater = new PathSetUpdater();
  }
  return pathSetUpdater;
}

// The return values of the following functions must be JSON-serializable so they
// can be sent across a process boundary.

export async function initFileSearchForDirectory(
  directory: string,
  ignoredNames: Array<string>,
): Promise<void> {
  await fileSearchForDirectory(directory, null, ignoredNames);
}

export async function doSearch(
  directory: string,
  query: string,
): Promise<Array<FileSearchResult>> {
  const pathSet = await fileSearchForDirectory(directory);
  return pathSet.query(query);
}
