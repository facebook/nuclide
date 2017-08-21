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
import type {CodeSearchResult} from './types';

import {Observable} from 'rxjs';
import {observeProcess} from 'nuclide-commons/process';

export function search(
  directory: NuclideUri,
  query: string,
): Observable<CodeSearchResult> {
  return observeProcess('rg', [
    query,
    directory,
    '--color',
    'never',
    '--ignore-case',
    '--line-number',
    '--column',
    '--no-heading',
    '--fixed-strings',
  ])
    .flatMap(event => {
      if (event.kind === 'stdout') {
        const matches = event.data.match(/([^:]+):([^:]+):([^:]+):(.*)/);
        if (matches != null && matches.length === 5) {
          const [file, row, column, line] = matches.slice(1);
          return Observable.of({
            file,
            row: parseInt(row, 10) - 1,
            column: parseInt(column, 10) - 1,
            line,
          });
        }
      }
      return Observable.empty();
    })
    .filter(x => x != null);
}
