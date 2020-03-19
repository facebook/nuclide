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
import type {CodeSearchTool} from '../../nuclide-code-search-rpc/lib/types';
import type {NuclideCodeSearchConfig} from './types';

import featureConfig from 'nuclide-commons-atom/feature-config';
import nuclideUri from 'nuclide-commons/nuclideUri';

export function pickConfigByUri(
  uri: NuclideUri,
): {tool: CodeSearchTool, useVcsSearch: boolean, maxResults: number} {
  const config: NuclideCodeSearchConfig = (featureConfig.get(
    'nuclide-code-search',
  ): any);
  const tool = nuclideUri.isRemote(uri) ? config.remoteTool : config.localTool;
  const useVcsSearch = nuclideUri.isRemote(uri)
    ? config.remoteUseVcsSearch
    : config.localUseVcsSearch;
  return {tool, useVcsSearch, maxResults: config.maxResults};
}
