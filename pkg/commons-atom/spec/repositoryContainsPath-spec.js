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

import type {
  HgService as HgServiceType,
} from '../../nuclide-hg-rpc/lib/HgService';

import {Directory, GitRepository} from 'atom';
import {repositoryContainsPath} from '../../nuclide-vcs-base';
import {runCommand} from 'nuclide-commons/process';
import MockHgService from '../../nuclide-hg-rpc/spec/MockHgService';
import {HgRepositoryClient} from '../../nuclide-hg-repository-client';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {generateFixture} from '../../nuclide-test-helpers';

describe('repositoryContainsPath', () => {
  let tempFolder: string = (null: any);
  let repoRoot: string = (null: any);

  beforeEach(() => {
    // Create a temporary Hg repository.
    waitsForPromise(async () => {
      tempFolder = await generateFixture(
        'hg-git-bridge',
        new Map([['repoRoot/file.txt', 'hello world']]),
      );
      repoRoot = nuclideUri.join(tempFolder, 'repoRoot');
    });
  });

  it('is accurate for GitRepository.', () => {
    waitsForPromise(async () => {
      // Create a temporary Git repository.
      await runCommand('git', ['init'], {cwd: repoRoot}).toPromise();

      const gitRepository = new GitRepository(repoRoot);
      // For some reason, the path returned in tests from
      // GitRepository.getWorkingDirectory is prepended with '/private',
      // which makes the Directory::contains method inaccurate in
      // `repositoryContainsPath`. We mock out the method here to get the
      // expected behavior.
      spyOn(gitRepository, 'getWorkingDirectory').andCallFake(() => {
        return repoRoot;
      });

      expect(repositoryContainsPath(gitRepository, repoRoot)).toBe(true);
      const subdir = nuclideUri.join(repoRoot, 'subdir');
      expect(repositoryContainsPath(gitRepository, subdir)).toBe(true);
      const parentDir = nuclideUri.resolve(tempFolder, '..');
      expect(repositoryContainsPath(gitRepository, parentDir)).toBe(false);
    });
  });

  it('is accurate for HgRepositoryClient.', () => {
    waitsForPromise(async () => {
      // Create temporary Hg repository.
      await runCommand('hg', ['init'], {cwd: repoRoot}).toPromise();

      const mockService = new MockHgService();
      const mockHgService: HgServiceType = (mockService: any);
      const hgRepositoryClient = new HgRepositoryClient(
        /* repoPath */
        nuclideUri.join(repoRoot, '.hg'),
        /* hgService */
        mockHgService,
        /* options */
        {
          originURL: 'testURL',
          workingDirectory: new Directory(repoRoot),
          projectRootDirectory: new Directory(repoRoot),
        },
      );

      const hgRepository: atom$Repository = (hgRepositoryClient: any);

      expect(repositoryContainsPath(hgRepository, repoRoot)).toBe(true);
      const subdir = nuclideUri.join(repoRoot, 'subdir');
      expect(repositoryContainsPath(hgRepository, subdir)).toBe(true);
      const parentDir = nuclideUri.resolve(tempFolder, '..');
      expect(repositoryContainsPath(hgRepository, parentDir)).toBe(false);
    });
  });
});
