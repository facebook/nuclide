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
import {generateHgRepo1Fixture} from '../pkg/nuclide-test-helpers';
import {hgConstants} from '../pkg/nuclide-hg-rpc';

const {AmendMode} = hgConstants;

import {repositoryForPath} from '../pkg/nuclide-vcs-base';
import {
  fetchFileContentAtRevision,
  fetchFilesChangedSinceRevision,
} from '../pkg/nuclide-hg-rpc/lib/hg-revision-state-helpers';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import invariant from 'assert';

describe('Mercurial Repository Integration Tests', () => {
  beforeEach(() => {
    waitsForPromise(async () => {
      jasmineIntegrationTestSetup();
      await activateAllPackages();
    });
  });

  it('adds opens and removes project without errors', () => {
    waitsForPromise(async () => {
      // Copy mercurial project to temporary directory.
      const repoPath = await generateHgRepo1Fixture();
      // Add this directory as a new project in atom.
      atom.project.setPaths([repoPath]);
      // Open a file within this project.
      await atom.workspace.open(nuclideUri.join(repoPath, 'test.txt'));
      // Verify mercurialness.
      const respositories = atom.project.getRepositories();
      expect(respositories.length).toBe(1);
      const repository = respositories[0];
      invariant(repository);
      expect(repository.getPath().endsWith('/.hg')).toBe(true);
      // Remove project
      atom.project.removePath(repoPath);
    });
  });

  it('can commit changes', () => {
    waitsForPromise({timeout: 20000}, async () => {
      const repoPath = await generateHgRepo1Fixture();
      const filePath = nuclideUri.join(repoPath, 'test.txt');
      atom.project.setPaths([repoPath]);
      const hgRepository = ((repositoryForPath(
        repoPath,
      ): any): HgRepositoryClient);
      invariant(hgRepository != null);
      await fsPromise.writeFile(filePath, 'new text');
      await hgRepository.commit('commit msg').toArray().toPromise();
      const changes = await fetchFilesChangedSinceRevision('.^', repoPath)
        .refCount()
        .toPromise();
      expect(changes.length).toEqual(1);
      expect(changes[0]).toEqual(filePath);
      const content = await fetchFileContentAtRevision(filePath, '.', repoPath)
        .refCount()
        .toPromise();
      expect(content).toEqual('new text');
    });
  });

  it('can amend changes', () => {
    waitsForPromise({timeout: 30000}, async () => {
      const repoPath = await generateHgRepo1Fixture();
      const filePath = nuclideUri.join(repoPath, 'test.txt');
      atom.project.setPaths([repoPath]);
      const hgRepository = ((repositoryForPath(
        repoPath,
      ): any): HgRepositoryClient);
      invariant(hgRepository != null);
      await fsPromise.writeFile(filePath, 'new text 1');
      await hgRepository.commit('commit msg 1').toArray().toPromise();
      await fsPromise.writeFile(filePath, 'new text 2');
      await hgRepository.commit('commit msg 2').toArray().toPromise();
      await fsPromise.writeFile(filePath, 'new text 3');
      await hgRepository
        .amend('commit msg 3', AmendMode.CLEAN)
        .toArray()
        .toPromise();
      const changes = await fetchFilesChangedSinceRevision('.^', repoPath)
        .refCount()
        .toPromise();
      expect(changes.length).toEqual(1);
      expect(changes[0]).toEqual(filePath);
      const content3 = await fetchFileContentAtRevision(filePath, '.', repoPath)
        .refCount()
        .toPromise();
      expect(content3).toEqual('new text 3');
      const content1 = await fetchFileContentAtRevision(
        filePath,
        '.^',
        repoPath,
      )
        .refCount()
        .toPromise();
      expect(content1).toEqual('new text 1');
    });
  });

  afterEach(() => {
    deactivateAllPackages();
  });
});
