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

import type {CodeSearchTool} from '../../nuclide-code-search-rpc/lib/types';

export type NuclideCodeSearchConfig = {
  localTool: CodeSearchTool,
  localUseVcsSearch: boolean,
  remoteTool: CodeSearchTool,
  remoteUseVcsSearch: boolean,
  maxResults: number,
};
