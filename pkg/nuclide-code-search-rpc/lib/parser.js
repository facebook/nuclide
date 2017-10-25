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

import type {CodeSearchResult} from './types';
import type {ProcessMessage} from 'nuclide-commons/process';

import {Observable} from 'rxjs';

export function parseAgAckRgLine(
  event: ProcessMessage,
): Observable<CodeSearchResult> {
  if (event.kind === 'stdout') {
    const matches = event.data.trim().match(/^(.+):(\d+):(\d+):(.*)$/);
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
}
