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

import type {
  search$FileResult,
  CodeSearchResult,
  CodeSearchTool,
} from './types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {resolveTool, searchWithTool} from './searchTools';
import {searchInDirectory, searchInDirectories} from './searchInDirectory';
import {
  isFuse,
  isNfs,
} from '../../nuclide-server/lib/services/FileSystemService';
import {ConnectableObservable, Observable} from 'rxjs';

// Limit the total result size to avoid overloading the Nuclide server + Atom.
const MATCH_BYTE_LIMIT = 2 * 1024 * 1024;

export async function isEligibleForDirectory(
  rootDirectory: NuclideUri,
): Promise<boolean> {
  const checks = await Promise.all([
    resolveTool(null).then(tool => tool == null),
    isNfs(rootDirectory),
    isFuse(rootDirectory),
  ]);
  return !checks.some(x => x);
}

/**
 * @param directory - The directory in which to perform a search.
 * @param regex - The pattern to match.
 * @param useVcsSearch - Whether to try to use hg/git grep to find the pattern.
 * @param tool - Which tool to use from POSIX_TOOLS or WINDOWS_TOOLS,
 *   default to first one available.
 * @param maxResults - Maximum number of results to emit.
 * @returns An observable that emits results.
 */
export function codeSearch(
  directory: NuclideUri,
  regex: RegExp,
  useVcsSearch: boolean,
  tool: ?CodeSearchTool,
  maxResults: number,
): ConnectableObservable<CodeSearchResult> {
  return searchInDirectory(tool, useVcsSearch, {
    regex,
    directory,
    recursive: true,
  })
    .take(maxResults)
    .publish();
}

/**
 * @param files - The files in which to perform a search.
 * @param regex - The pattern to match.
 * @param tool - Which tool to use from POSIX_TOOLS or WINDOWS_TOOLS,
 *   default to first one available.
 * @param maxResults - Maximum number of results to emit.
 * @returns An observable that emits results.
 */
export function searchFiles(
  files: Array<NuclideUri>,
  regex: RegExp,
  tool: ?CodeSearchTool,
  leadingLines?: number,
  trailingLines?: number,
  maxResults?: number,
): ConnectableObservable<CodeSearchResult> {
  return searchWithTool(tool, {
    recursive: false,
    files,
    regex,
    leadingLines,
    trailingLines,
    limit: maxResults,
  }).publish();
}

/**
 * Searches for all instances of a pattern in subdirectories.
 * @returns An observable that emits match events.
 */
export function remoteAtomSearch(
  // The directory in which to perform a search.
  directory: NuclideUri,
  // The pattern to match.
  regex: RegExp,
  // An array of subdirectories to search within `directory`. If subdirs is an
  // empty array, then simply search in directory.
  subdirs: Array<string>,
  // Whether to try to use hg/git grep to find the pattern.
  useVcsSearch: boolean,
  // Which tool to use from POSIX_TOOLS or WINDOWS_TOOLS,
  // default to first one available.
  tool: ?CodeSearchTool,
  // Number of leading context lines to include.
  leadingLines?: ?number,
  // Number of trailing context lines to include.
  trailingLines?: ?number,
): ConnectableObservable<search$FileResult> {
  return mergeSearchResults(
    searchInDirectories(subdirs, tool, useVcsSearch, {
      regex,
      leadingLines,
      trailingLines,
      recursive: true,
      directory,
    }),
  ).publish();
}

// Convert CodeSearchResults into search$FileResult.
function mergeSearchResults(
  codeSearchResults: Observable<CodeSearchResult>,
): Observable<search$FileResult> {
  const results = codeSearchResults
    .map(
      ({
        file,
        row,
        line,
        column,
        matchLength,
        leadingContext,
        trailingContext,
      }) => ({
        filePath: file,
        match: {
          lineText: line,
          lineTextOffset: 0,
          matchText: line.slice(column, column + matchLength),
          range: [[row, column], [row, column + matchLength]],
          leadingContextLines: leadingContext,
          trailingContextLines: trailingContext,
        },
      }),
    )
    .share();

  return (
    results
      // Limit the total result size.
      .merge(
        results
          .scan(
            (size, {match}) =>
              size + match.lineText.length + match.matchText.length,
            0,
          )
          .filter(size => size > MATCH_BYTE_LIMIT)
          .switchMapTo(
            Observable.throw(
              Error(
                `Too many results, truncating to ${MATCH_BYTE_LIMIT} bytes`,
              ),
            ),
          )
          .ignoreElements(),
      )
      // Buffer results by file. Flush when the file changes, or on completion.
      .buffer(
        Observable.concat(
          results.distinct(result => result.filePath),
          Observable.of(null),
        ),
      )
      .filter(buffer => buffer.length > 0)
      .map(buffer => ({
        filePath: buffer[0].filePath,
        matches: buffer.map(x => x.match),
      }))
  );
}
