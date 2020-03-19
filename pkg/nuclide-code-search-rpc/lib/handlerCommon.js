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

import type {ProcessMessage} from 'nuclide-commons/process';
import type {ParseResult} from './parser';
import type {CodeSearchResult} from './types';

import {arrayFlatten} from 'nuclide-commons/collection';
import {observeProcess} from 'nuclide-commons/process';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';

export const BUFFER_SIZE_LIMIT = 1000 * 1000 * 50; // 50 MB

// Grep and related tools (ack, rg) have exit code 1 with no results.
export function observeGrepLikeProcess(
  command: string,
  args: Array<string>,
  cwd?: string,
): Observable<ProcessMessage> {
  return observeProcess(command, args, {
    cwd,
    maxBuffer: BUFFER_SIZE_LIMIT,
    // An exit code of 0 or 1 is normal for grep-like tools.
    isExitError: ({exitCode, signal}) => {
      return (
        // flowlint-next-line sketchy-null-string:off
        !signal && (exitCode == null || exitCode > 1)
      );
    },
  });
}

// Parse each line of output and construct code search results.
export function mergeOutputToResults(
  processOutput: Observable<ProcessMessage>,
  parse: ProcessMessage => Observable<ParseResult>,
  regex: RegExp,
  leadingLines: number,
  trailingLines: number,
): Observable<CodeSearchResult> {
  const parsedResults = processOutput.concatMap(parse).publish();
  return Observable.create(observer => {
    const subscription = parsedResults
      .buffer(
        parsedResults
          .distinct(result => result.file)
          .concat(Observable.of(null)),
      )
      .concatMap(results => {
        // Build map from line number to line contents.
        const lineMap = new Map(results.map(line => [line.row, line.line]));
        // Return array of line contents for lines [fr, to). Skip undefined lines.
        function getLines(fr, to) {
          const lineContents = [];
          for (let _line = fr; _line < to; _line++) {
            const t = lineMap.get(_line);
            if (t != null) {
              lineContents.push(t);
            }
          }
          return lineContents;
        }
        // run input regex on each line and emit CodeSearchResult for each match
        return Observable.from(
          arrayFlatten(
            results.map(parseResult => {
              const {file, row, line} = parseResult;
              const allMatches = [];
              let match = regex.exec(line);
              while (match != null) {
                // Some invalid regex (e.g. /||/g) will always match,
                // but with an empty match string, so the exec loop becomes infinite.
                // Check for this case and abort early.
                if (match[0].length === 0) {
                  break;
                }
                allMatches.push({
                  file,
                  row,
                  line,
                  column: match.index,
                  matchLength: match[0].length,
                  leadingContext: getLines(row - leadingLines, row),
                  trailingContext: getLines(row + 1, row + trailingLines + 1),
                });
                if (!regex.global) {
                  // looping exec on a non-global regex is an infinite loop.
                  break;
                }
                match = regex.exec(line);
              }
              regex.lastIndex = 0;
              return allMatches;
            }),
          ),
        );
      })
      .subscribe(observer);
    const processSubscription = parsedResults.connect();
    return new UniversalDisposable(subscription, processSubscription);
  });
}
