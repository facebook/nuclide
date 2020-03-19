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
import type {CodeSearchTool} from './types';
import type {ProcessMessage} from 'nuclide-commons/process';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';

export const PARSE_REGEXES = Object.freeze({
  rg: /^(.+)\0(\d+)[:-](.*)$/,
  ack: /^(.+)[:-](\d+)[:-](.*)$/,
  grep: /^(.+)\0(\d+)[:-](.*)$/,
  vcsGrep: /^(.+)[:-](\d+)[:-](.*)$/,
});

export type ParseResult = {
  file: NuclideUri,
  row: number,
  line: string,
};

export function parseProcessLine(
  event: ProcessMessage,
  tool: CodeSearchTool | 'vcsGrep',
): Observable<ParseResult> {
  const parseRegex = PARSE_REGEXES[tool];
  if (event.kind === 'stdout') {
    const matches = event.data.trim().match(parseRegex);
    if (matches != null && matches.length === 4) {
      const [file, row, line] = matches.slice(1);
      return Observable.of({
        file,
        row: parseInt(row, 10) - 1,
        line,
      });
    }
  }
  return Observable.empty();
}

export function parseVcsGrepLine(
  event: ProcessMessage,
  cwd: string,
  regex: RegExp,
): Observable<ParseResult> {
  // Note: the vcs-grep searches return paths rooted from their cwd,
  // so join the paths to make them absolute.
  return parseProcessLine(event, 'vcsGrep').map(result => ({
    ...result,
    file: nuclideUri.isAbsolute(result.file)
      ? result.file
      : nuclideUri.join(cwd, result.file),
  }));
}
