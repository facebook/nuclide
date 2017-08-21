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

import {findArcProjectIdOfPath} from '../../nuclide-arcanist-rpc';
import {search as agAckSearch} from './AgAckService';
import {search as rgSearch} from './RgService';
import {ConnectableObservable, Observable} from 'rxjs';

export async function isEligibleForDirectory(
  rootDirectory: NuclideUri,
): Promise<boolean> {
  const projectId = await findArcProjectIdOfPath(rootDirectory);
  if (projectId == null) {
    return true;
  }

  try {
    // $FlowFB
    const bigGrep = require('../../commons-atom/fb-biggrep-query'); // eslint-disable-line nuclide-internal/no-cross-atom-imports
    const corpus = bigGrep.ARC_PROJECT_CORPUS[projectId];
    if (corpus != null) {
      return false;
    }
  } catch (err) {}
  return true;
}

const searchToolHandlers = new Map([
  [
    'ag',
    (directory: string, query: string) => agAckSearch(directory, query, 'ag'),
  ],
  [
    'ack',
    (directory: string, query: string) => agAckSearch(directory, query, 'ack'),
  ],
  ['rg', rgSearch],
]);

export function searchWithTool(
  tool: string,
  directory: NuclideUri,
  query: string,
  maxResults: number,
): ConnectableObservable<CodeSearchResult> {
  const handler = searchToolHandlers.get(tool);
  if (handler != null) {
    return handler(directory, query).take(maxResults).publish();
  }
  return Observable.empty().publish();
}
