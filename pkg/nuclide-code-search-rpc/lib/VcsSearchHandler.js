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

import type {CodeSearchResult, DirectoryCodeSearchParams} from './types';

import {Observable} from 'rxjs';
import {observeProcess} from 'nuclide-commons/process';
import {mergeOutputToResults} from './handlerCommon';
import {parseVcsGrepLine} from './parser';

export function search({
  regex,
  directory,
  leadingLines,
  trailingLines,
}: DirectoryCodeSearchParams): Observable<CodeSearchResult> {
  const sharedArgs = [];
  if (regex.ignoreCase) {
    sharedArgs.push('-i');
  }
  // hg grep actually requires no space between A/B and the parameter!
  // git grep doesn't seem to mind.
  if (leadingLines != null) {
    sharedArgs.push('-B' + String(leadingLines));
  }
  if (trailingLines != null) {
    sharedArgs.push('-A' + String(trailingLines));
  }
  // TODO: handle limit in params
  sharedArgs.push(
    // print line number
    '-n',
    '-E',
    regex.source,
    directory,
  );
  const observeVcsGrepProcess = (command, subcommand) => {
    return observeProcess(command, [subcommand].concat(sharedArgs), {
      cwd: directory,
      // An exit code of 0 or 1 is perfectly normal for grep (1 = no results).
      // `hg grep` can sometimes have an exit code of 123, since it uses xargs.
      isExitError: ({exitCode, signal}) => {
        return (
          // flowlint-next-line sketchy-null-string:off
          !signal && (exitCode == null || (exitCode > 1 && exitCode !== 123))
        );
      },
    });
  };
  // Try running search commands, falling through to the next if there is an error.
  return mergeOutputToResults(
    observeVcsGrepProcess('git', 'grep').catch(() =>
      observeVcsGrepProcess('hg', 'wgrep'),
    ),
    event => parseVcsGrepLine(event, directory, regex),
    regex,
    leadingLines || 0,
    trailingLines || 0,
  );
}
