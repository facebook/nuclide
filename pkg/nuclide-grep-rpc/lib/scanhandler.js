'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {
  search$FileResult,
  search$Match,
} from '..';

import {Observable} from 'rxjs';

import {safeSpawn} from '../../commons-node/process';
import {compact} from '../../commons-node/observable';
import fsPromise from '../../commons-node/fsPromise';
import nuclideUri from '../../commons-node/nuclideUri';
import {Minimatch} from 'minimatch';
import split from 'split';

// This pattern is used for parsing the output of grep.
const GREP_PARSE_PATTERN = /(.*?):(\d*):(.*)/;

// Limit the total result size to avoid overloading the Nuclide server + Atom.
const MATCH_BYTE_LIMIT = 2 * 1024 * 1024;

/**
 * Searches for all instances of a pattern in a directory.
 * @param directory - The directory in which to perform a search.
 * @param regex - The pattern to match.
 * @param subdirs - An array of subdirectories to search within `directory`. If subdirs is an
 *   empty array, then simply search in directory.
 * @returns An observable that emits match events.
 */
export default function search(
  directory: string,
  regex: RegExp,
  subdirs: Array<string>,
): Observable<search$FileResult> {
  // Matches are stored in a Map of filename => Array<Match>.
  const matchesByFile: Map<string, Array<search$Match>> = new Map();

  if (!subdirs || subdirs.length === 0) {
    // Since no subdirs were specified, run search on the root directory.
    return searchInSubdir(matchesByFile, directory, '.', regex);
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
    return searchInSubdir(matchesByFile, directory, '.', regex)
      .filter(
        result => Boolean(matchers.find(matcher => matcher.match(result.filePath))),
      );
  } else {
    // Run the search on each subdirectory that exists.
    return Observable.from(subdirs).concatMap(async subdir => {
      try {
        const stat = await fsPromise.lstat(nuclideUri.join(directory, subdir));
        if (stat.isDirectory()) {
          return searchInSubdir(matchesByFile, directory, subdir, regex);
        } else {
          return Observable.empty();
        }
      } catch (e) {
        return Observable.empty();
      }
    }).mergeAll();
  }
}

// Helper function that runs the search command on the given directory
// `subdir`, relative to `directory`. The function returns an Observable that emits
// search$FileResult objects.
function searchInSubdir(
  matchesByFile: Map<string, Array<search$Match>>,
  directory: string,
  subdir: string,
  regex: RegExp,
): Observable<search$FileResult> {
  // Try running search commands, falling through to the next if there is an error.
  const vcsargs = (regex.ignoreCase ? ['-i'] : []).concat(['-n', '-E', regex.source]);
  const grepargs = (regex.ignoreCase ? ['-i'] : []).concat(['-rHn', '-E', '-e', regex.source, '.']);
  const cmdDir = nuclideUri.join(directory, subdir);
  const linesSource =
    getLinesFromCommand('hg', ['wgrep'].concat(vcsargs), cmdDir)
    .catch(() => getLinesFromCommand('git', ['grep'].concat(vcsargs), cmdDir))
    .catch(() => getLinesFromCommand('grep', grepargs, cmdDir))
    .catch(() => Observable.throw(new Error('Failed to execute a grep search.')));

  // Transform lines into file matches.
  const results = compact(linesSource.map((line: string) => {
    // Try to parse the output of grep.
    const grepMatchResult = line.match(GREP_PARSE_PATTERN);
    if (!grepMatchResult) {
      return null;
    }

    // Extract the filename, line number, and line text from grep output.
    const lineText = grepMatchResult[3];
    const lineNo = parseInt(grepMatchResult[2], 10) - 1;
    const filePath = nuclideUri.join(subdir, grepMatchResult[1]);

    // Try to extract the actual "matched" text.
    const matchTextResult = regex.exec(lineText);
    if (!matchTextResult) {
      return null;
    }

    // IMPORTANT: reset the regex for the next search
    regex.lastIndex = 0;

    const matchText = matchTextResult[0];
    const matchIndex = matchTextResult.index;

    return {
      filePath,
      match: {
        lineText,
        lineTextOffset: 0,
        matchText,
        range: [[lineNo, matchIndex], [lineNo, matchIndex + matchText.length]],
      },
    };
  })).share();

  return results
    // Limit the total result size.
    .merge(
      results
        .scan((size, {match}) => size + match.lineText.length + match.matchText.length, 0)
        .filter(size => size > MATCH_BYTE_LIMIT)
        .switchMapTo(
          Observable.throw(Error(`Too many results, truncating to ${MATCH_BYTE_LIMIT} bytes`)),
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
    }));
}


// Helper function that runs a command in a given directory, invoking a callback
// as each line is written to stdout.
function getLinesFromCommand(
  command: string,
  args: Array<string>,
  localDirectoryPath: string,
): Observable<string> {
  return Observable.create(observer => {
    let exited = false;

    // Spawn the search command in the given directory.
    const proc = safeSpawn(command, args, {cwd: localDirectoryPath});

    // Reject on error.
    proc.on('error', observer.error.bind(observer));

    // Call the callback on each line.
    proc.stdout.pipe(split()).on('data', observer.next.bind(observer));

    // Keep a running string of stderr, in case we need to throw an error.
    let stderr = '';
    proc.stderr.on('data', data => {
      stderr += data;
    });

    // Resolve promise if error code is 0 (found matches) or 1 (found no matches). Otherwise
    // reject. However, if a process was killed with a signal, don't reject, since this was likely
    // to cancel the search.
    proc.on('close', (code, signal) => {
      exited = true;
      if (signal || code <= 1) {
        observer.complete();
      } else {
        observer.error(new Error(stderr));
      }
    });

    // Kill the search process on dispose.
    return () => {
      if (!exited) {
        proc && proc.kill();
      }
    };
  });
}
