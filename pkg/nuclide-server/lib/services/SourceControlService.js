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

import {findHgRepository} from '../../../nuclide-source-control-helpers';

/**
 * This is a workaround that should be removed when Atom 2.0 comes out.
 * See t6913624.
 */
export type HgRepositoryDescription = {
  repoPath: string,
  originURL: ?string,
  workingDirectoryPath: string,
};

export function getHgRepository(
  directoryPath: string,
): Promise<?HgRepositoryDescription> {
  return Promise.resolve(findHgRepository(directoryPath));
}
