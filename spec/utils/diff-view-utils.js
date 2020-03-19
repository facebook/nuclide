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

import type {HgRepositoryClient} from '../../pkg/nuclide-hg-repository-client';

import invariant from 'assert';
import {repositoryForPath} from '../../pkg/nuclide-vcs-base';

function hgRepositoryForPath(filePath: string): HgRepositoryClient {
  const repository = repositoryForPath(filePath);
  invariant(
    repository != null && repository.getType() === 'hg',
    'non-hg repository',
  );
  return (repository: any);
}

export async function waitsForRepositoryReady(filePath: string): Promise<void> {
  await hgRepositoryForPath(filePath)._sharedMembers.repoSubscriptions;
}
