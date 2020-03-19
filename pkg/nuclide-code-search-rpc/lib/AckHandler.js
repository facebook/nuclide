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

import type {CodeSearchResult, CodeSearchParams} from './types';

import {Observable} from 'rxjs';
import {observeGrepLikeProcess, mergeOutputToResults} from './handlerCommon';
import {parseProcessLine} from './parser';

export function search(params: CodeSearchParams): Observable<CodeSearchResult> {
  const {regex, limit, leadingLines, trailingLines} = params;
  const searchSources = params.recursive ? [params.directory] : params.files;
  if (searchSources.length === 0) {
    return Observable.empty();
  }
  const baseArgs = [];
  if (regex.ignoreCase) {
    baseArgs.push('--ignore-case');
  }
  if (limit != null) {
    baseArgs.push('-m', String(limit));
  }
  const output = observeGrepLikeProcess(
    'ack',
    baseArgs
      .concat(leadingLines != null ? ['-B', String(leadingLines)] : [])
      .concat(trailingLines != null ? ['-A', String(trailingLines)] : [])
      .concat([
        // no colors, one result per line, always show filename, no smart case
        '--with-filename',
        '--nosmart-case',
        '--nocolor',
        '--nopager',
        '--nogroup',
        regex.source,
      ])
      .concat(searchSources),
  );
  return mergeOutputToResults(
    output,
    event => parseProcessLine(event, 'ack'),
    regex,
    leadingLines || 0,
    trailingLines || 0,
  );
}
