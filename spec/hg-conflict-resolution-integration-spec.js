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

import {
  activateAllPackages,
  deactivateAllPackages,
  jasmineIntegrationTestSetup,
} from './utils/integration-test-helpers';
import {
  generateHgRepo3Fixture,
  overwriteFileWithTestContent,
} from '../pkg/nuclide-test-helpers';

import {repositoryForPath} from '../pkg/nuclide-vcs-base';
import invariant from 'assert';

describe('Mercurial Conflict Resolution Flow Integration Tests', () => {
  beforeEach(() => {
    waitsForPromise(async () => {
      jasmineIntegrationTestSetup();
      await activateAllPackages();
    });
  });

  // eslint-disable-next-line
  xit('can manage conflicts encountered during rebase and continue', () => {
    waitsForPromise({timeout: 60000}, async () => {
      const fileName = 'temp.txt';
      const repoPath = await generateHgRepo3Fixture(fileName);
      atom.project.setPaths([repoPath]);
      const hgRepository = ((repositoryForPath(
        repoPath,
      ): any): HgRepositoryClient);
      invariant(hgRepository != null);
      await hgRepository.rebase('firstCommit', 'secondCommit').toPromise();
      const conflicts = await hgRepository.fetchMergeConflicts().toPromise();
      expect(conflicts).not.toBeNull();
      invariant(conflicts != null);
      expect(conflicts.command_details.cmd).toBe(
        'rebase',
        'Expected command to be rebase',
      );
      expect(conflicts.conflicts.length).toBe(1);
      overwriteFileWithTestContent(fileName, repoPath);
      await hgRepository
        .markConflictedFile(fileName, true /* resolved */)
        .toPromise();
      const conflictsAfterResolve = await hgRepository
        .fetchMergeConflicts()
        .toPromise();
      invariant(conflictsAfterResolve != null);
      expect(conflictsAfterResolve.conflicts.length).toBe(0);
      expect(conflictsAfterResolve.command_details.to_continue).toEqual(
        'rebase --continue',
      );
      expect(conflictsAfterResolve.command_details.to_abort).toEqual(
        'rebase --abort',
      );
      await hgRepository
        .continueOperation(
          conflictsAfterResolve.command_details.to_continue.split(' '),
        )
        .toPromise();
      const conflictsAfterContinue = await hgRepository
        .fetchMergeConflicts()
        .toPromise();
      expect(conflictsAfterContinue).toBeNull(
        'Merge conflicts should have been resolved',
      );
    });
  });

  afterEach(() => {
    waitsForPromise(() => deactivateAllPackages());
  });
});
