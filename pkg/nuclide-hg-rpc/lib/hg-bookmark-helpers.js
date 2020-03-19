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

import type {BookmarkInfo} from './types';

import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-hg-rpc');

/**
 * @param repoPath The full path to the repository directory (.hg).
 * @return A promise that resolves to the current bookmark name, if it exists,
 *   or else an empty string.
 */
export async function fetchActiveBookmark(repoPath: string): Promise<string> {
  const bookmarkFile = nuclideUri.join(repoPath, 'bookmarks.current');
  let result;
  try {
    result = await fsPromise.readFile(bookmarkFile, 'utf-8');
  } catch (e) {
    if (!(e.code === 'ENOENT')) {
      // We expect an error if the bookmark file doesn't exist. Otherwise, the
      // error is unexpected, so log it.
      logger.error(e);
    }
    result = '';
  }
  return result;
}

export async function fetchBookmarks(
  repoPath: string,
): Promise<Array<BookmarkInfo>> {
  const bookmarkFile = nuclideUri.join(repoPath, 'bookmarks');
  let result;
  try {
    const bookmarks = await fsPromise.readFile(bookmarkFile, 'utf-8');
    const activeBookmark = await fetchActiveBookmark(repoPath);
    result = bookmarks
      .split('\n')
      .filter(bookmark => bookmark.length > 0)
      .map(bookmarkEntry => {
        const [node, bookmark] = bookmarkEntry.split(' ');
        return {
          node,
          bookmark,
          active: activeBookmark === bookmark,
        };
      });
  } catch (e) {
    if (!(e.code === 'ENOENT')) {
      // We expect an error if the bookmark file doesn't exist. Otherwise, the
      // error is unexpected, so log it.
      logger.error(e);
    }
    result = [];
  }
  return result;
}
