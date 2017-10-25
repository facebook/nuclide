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
import {parseAgAckRgLine} from './parser';

export function search(
  directory: NuclideUri,
  query: string,
  tool: 'ag' | 'ack',
): Observable<CodeSearchResult> {
  return observeProcess(tool, [
    '--nocolor',
    '--column',
    '--nogroup',
    '--literal',
    '--ignore-case',
    query,
    directory,
  ]).flatMap(event => parseAgAckRgLine(event));
}
