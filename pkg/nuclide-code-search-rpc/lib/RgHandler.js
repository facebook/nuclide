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
import {
  observeGrepLikeProcess,
  mergeOutputToResults,
  BUFFER_SIZE_LIMIT,
} from './handlerCommon';
import {parseProcessLine} from './parser';

export function search(params: CodeSearchParams): Observable<CodeSearchResult> {
  const {regex, limit, leadingLines, trailingLines} = params;
  const searchSources = params.recursive ? [params.directory] : params.files;
  if (searchSources.length === 0) {
    return Observable.empty();
  }
  // Javascript escapes the slash when constructing the regexp,
  // but Rust's regex library is picky about extra escapes:
  // see https://github.com/rust-lang/regex/issues/93#issuecomment-196022003
  const source = regex.source.split('\\/').join('/');
  const output = observeGrepLikeProcess(
    'rg',
    (regex.ignoreCase ? ['--ignore-case'] : [])
      .concat(leadingLines != null ? ['-B', String(leadingLines)] : [])
      .concat(trailingLines != null ? ['-A', String(trailingLines)] : [])
      .concat([
        // no colors, show line number, search hidden files, limit line length
        // one result per line, show filename with null byte
        '--color',
        'never',
        '--line-number',
        '--hidden',
        '--no-heading',
        '--max-columns',
        String(BUFFER_SIZE_LIMIT),
        '-H',
        '-0',
        '-e',
        source,
      ])
      .concat(searchSources),
  );
  const results = mergeOutputToResults(
    output,
    event => parseProcessLine(event, 'rg'),
    regex,
    leadingLines || 0,
    trailingLines || 0,
  );
  return limit != null ? results.take(limit) : results;
}
