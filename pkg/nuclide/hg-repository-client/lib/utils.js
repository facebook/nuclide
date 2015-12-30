'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

const path = require('path');
const {ensureTrailingSeparator} = require('../../commons').paths;

const ADD_ACTION = 'add';
const REMOVE_ACTION = 'remove';
type DirectoriesCacheOperation = 'add' | 'remove';

const separatorRegex = new RegExp('\\' + path.sep, 'g');

/**
 * This function takes in a file path, and computes all directories that would
 * be considered a parent of it, i.e., the file path is contained by all of these
 * directories. The function sets the directories (terminated by a separator) as
 * keys in the `directories` Map, and bumps the value accordingly.
 * @param directories The Map that will be modified by this function. The keys are
 *   expected to be directory paths (terminated by a separator) and the values are
 *   the number of times this directory path has been 'added' to this Map.
 * @param modifiedPath A file path (assumed to not have a trailing separator).
 * @param pathPrefixToSkip Optionally, a string that, if found at the beginning
 *   of the modifiedPath, will be skipped when computing the parent directories.
 *   That is, if modifiedPath is /A/B/C/D and pathPrefixToSkip is /A/B/ (or /A/B),
 *   `directories` will be populated with '/A/B/C/', but not '/A/' or '/A/B/'.
 */
function addAllParentDirectoriesToCache(
    directories: Map<string, number>,
    modifiedPath: string,
    pathPrefixToSkip: ?string
  ) {
  computeAllParentDirectories(
    directories,
    modifiedPath,
    pathPrefixToSkip,
    ADD_ACTION
  );
}

/**
 * Like `addAllParentDirectoriesToCache`, except it removes all parent directories.
 */
function removeAllParentDirectoriesFromCache(
    directories: Map<string, number>,
    modifiedPath: string,
    pathPrefixToSkip: ?string
  ) {
  computeAllParentDirectories(
    directories,
    modifiedPath,
    pathPrefixToSkip,
    REMOVE_ACTION
  );
}


/**
 * Helper function to `addAllParentDirectoriesToCache` and
 * `removeAllParentDirectoriesFromCach`. Either adds or removes the computed
 * parent directories depending on the operation passed in.
 */
function computeAllParentDirectories(
    directories: Map<string, number>,
    modifiedPath: string,
    pathPrefixToSkip: ?string,
    operation: DirectoriesCacheOperation
  ) {
  // Reset the regex so it will start the next search at the beginning of the string.
  separatorRegex.lastIndex = 0;

  if (pathPrefixToSkip) {
    // Setting the lastIndex determines where the next search begins.
    separatorRegex.lastIndex = ensureTrailingSeparator(pathPrefixToSkip).length;
  }

  const shouldAdd = (operation === ADD_ACTION);
  let match;
  while ((match = separatorRegex.exec(modifiedPath))) {
    const newSubPath = modifiedPath.slice(0, match.index + 1);
    if (shouldAdd) {
      addItemToCache(newSubPath, directories);
    } else {
      removeItemFromCache(newSubPath, directories);
    }
  }
}

function addItemToCache(item: string, cache: Map<string, number>) {
  const existingValue = cache.get(item);
  if (existingValue) {
    cache.set(item, existingValue + 1);
  } else {
    cache.set(item, 1);
  }
}

function removeItemFromCache(item: string, cache: Map<string, number>) {
  const existingValue = cache.get(item);
  if (existingValue) {
    const newValue = existingValue - 1;
    if (newValue > 0) {
      cache.set(item, newValue);
    } else {
      cache.delete(item);
    }
  }
}


module.exports = {
  addAllParentDirectoriesToCache,
  removeAllParentDirectoriesFromCache,
};
