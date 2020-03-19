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

import {Observable} from 'rxjs';
import {
  activateAllPackages,
  deactivateAllPackages,
  jasmineIntegrationTestSetup,
} from './utils/integration-test-helpers';
import {generateHgRepo2Fixture} from '../pkg/nuclide-test-helpers';

import {repositoryForPath} from '../pkg/nuclide-vcs-base';
import invariant from 'assert';

describe('Mercurial fold Integration Tests', () => {
  beforeEach(() => {
    waitsForPromise(async () => {
      jasmineIntegrationTestSetup();
      await activateAllPackages();
    });
  });

  it('can fold commits', () => {
    waitsForPromise({timeout: 60000}, async () => {
      const repoPath = await generateHgRepo2Fixture();

      atom.project.setPaths([repoPath]);
      const hgRepository = ((repositoryForPath(
        repoPath,
      ): any): HgRepositoryClient);
      invariant(hgRepository != null);

      const from = '.^';
      const to = '.';
      const message = 'new message';

      const revisionsInfoInitial = await hgRepository
        .fetchSmartlogRevisions()
        .toPromise();
      expect(revisionsInfoInitial.length).toEqual(3);

      const foldResult = await hgRepository.fold(from, to, message).toPromise();

      expect(foldResult).toContain('2 changesets folded');

      const revisionsInfo = await hgRepository
        .fetchSmartlogRevisions()
        .toPromise();
      expect(revisionsInfo.length).toEqual(2);
      expect(revisionsInfo[1].title).toEqual(message);
    });
  });

  it('can fail when folding commits', () => {
    waitsForPromise({timeout: 60000}, async () => {
      const repoPath = await generateHgRepo2Fixture();

      atom.project.setPaths([repoPath]);
      const hgRepository = ((repositoryForPath(
        repoPath,
      ): any): HgRepositoryClient);
      invariant(hgRepository != null);

      const from = '11111';
      const to = '22222';
      const message = 'new message';

      const revisionsInfoInitial = await hgRepository
        .fetchSmartlogRevisions()
        .toPromise();
      expect(revisionsInfoInitial.length).toEqual(3);

      const foldResult = await hgRepository
        .fold(from, to, message)
        .catch(err => {
          return Observable.of(err.stderr);
        })
        .toPromise();

      expect(foldResult).toEqual("abort: unknown revision '11111'!\n");

      const revisionsInfo = await hgRepository
        .fetchSmartlogRevisions()
        .toPromise();
      expect(revisionsInfo.length).toEqual(3);
    });
  });

  afterEach(() => {
    waitsForPromise(() => deactivateAllPackages());
  });
});
