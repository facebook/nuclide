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

import type {CodeSearchResult, CodeSearchParams, CodeSearchTool} from './types';
import {asyncFind} from 'nuclide-commons/promise';
import os from 'os';

import which from 'nuclide-commons/which';
import {Observable} from 'rxjs';
import {search as ackSearch} from './AckHandler';
import {search as grepSearch} from './GrepHandler';
import {search as rgSearch} from './RgHandler';

export const WINDOWS_TOOLS = ['rg', 'grep'];
export const POSIX_TOOLS = ['rg', 'ack', 'grep'];

const searchToolHandlers = Object.freeze({
  ack: ackSearch,
  rg: rgSearch,
  grep: grepSearch,
});

export async function resolveTool(
  tool: ?CodeSearchTool,
): Promise<?CodeSearchTool> {
  if (tool != null) {
    return tool;
  }
  return asyncFind(os.platform() === 'win32' ? WINDOWS_TOOLS : POSIX_TOOLS, t =>
    which(t).then(cmd => (cmd != null ? t : null)),
  );
}

export function searchWithTool(
  tool: ?CodeSearchTool,
  params: CodeSearchParams,
): Observable<CodeSearchResult> {
  return Observable.defer(() => resolveTool(tool)).switchMap(actualTool => {
    if (actualTool != null) {
      const handler = searchToolHandlers[actualTool];
      return handler(params);
    }
    return Observable.empty();
  });
}
