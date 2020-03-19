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

import type {HgRepositoryClient} from '../pkg/nuclide-hg-repository-client';

import {generateHgRepo4Fixture} from '../pkg/nuclide-test-helpers/lib/fixtures';
import {
  activateAllPackages,
  deactivateAllPackages,
  jasmineIntegrationTestSetup,
} from './utils/integration-test-helpers';

import {repositoryForPath} from '../pkg/nuclide-vcs-base';
import invariant from 'assert';

describe('Mercurial Reorder Integration Tests', () => {
  beforeEach(() => {
    waitsForPromise(async () => {
      jasmineIntegrationTestSetup();
      await activateAllPackages();
    });
  });

  it('can do stack reorder', () => {
    waitsForPromise({timeout: 30000}, async () => {
      const repoPath = await generateHgRepo4Fixture();

      atom.project.setPaths([repoPath]);
      const hgRepository = ((repositoryForPath(
        repoPath,
      ): any): HgRepositoryClient);
      invariant(hgRepository != null);

      const revisionsInfoInitial = await hgRepository
        .fetchSmartlogRevisions()
        .toPromise();
      expect(revisionsInfoInitial.length).toEqual(6);

      const orderedRevisions = revisionsInfoInitial
        .filter(
          info => info.title !== 'base commit' && info.title !== 'other commit',
        )
        .map(info => info.hash);
      const permuation = [4, 3, 1, 2];
      const reorderedRevisions = permuation.map(i => orderedRevisions[i - 1]);

      await hgRepository.reorderWithinStack(reorderedRevisions).toPromise();

      const revisionsInfo = await hgRepository
        .fetchSmartlogRevisions()
        .toPromise();
      expect(revisionsInfo.length).toEqual(6);
      expect(revisionsInfo[0].title).toEqual('base commit');
      expect(revisionsInfo[1].title).toEqual('other commit');
      expect(revisionsInfo[1].parents).toContain(revisionsInfo[0].hash);

      expect(revisionsInfo[2].title).toEqual('commit 4');
      expect(revisionsInfo[2].parents).toContain(revisionsInfo[0].hash);

      expect(revisionsInfo[3].title).toEqual('commit 3');
      expect(revisionsInfo[3].parents).toContain(revisionsInfo[2].hash);

      expect(revisionsInfo[4].title).toEqual('commit 1');
      expect(revisionsInfo[4].parents).toContain(revisionsInfo[3].hash);

      expect(revisionsInfo[5].title).toEqual('commit 2');
      expect(revisionsInfo[5].parents).toContain(revisionsInfo[4].hash);
    });
  });

  afterEach(() => {
    waitsForPromise(() => deactivateAllPackages());
  });
});
