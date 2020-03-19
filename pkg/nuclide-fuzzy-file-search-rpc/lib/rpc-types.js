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
import type {ClientQueryContext} from '../../commons-atom/ClientQueryContext';

export type FileSearchResult = {
  path: NuclideUri,
  score: number,
  matchIndexes: Array<number>,
};

export type DirectorySearchConfig =
  | {
      useCustomSearch: false,
    }
  | {
      useCustomSearch: true,
      search(
        queryString: string,
        rootDirectory: NuclideUri,
        context: ?ClientQueryContext,
      ): Promise<Array<FileSearchResult>>,
    };
