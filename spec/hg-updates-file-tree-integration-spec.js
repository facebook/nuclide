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
import type {RevisionInfo} from '../pkg/nuclide-hg-rpc/lib/types';
import type {TestContext} from './utils/remotable-tests';

import featureConfig from 'nuclide-commons-atom/feature-config';
import fsPromise from 'nuclide-commons/fsPromise';
import {hgConstants} from '../pkg/nuclide-hg-rpc';
import invariant from 'assert';
import shallowEqual from 'shallowequal';
import nullthrows from 'nullthrows';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {generateHgRepo1Fixture} from '../pkg/nuclide-test-helpers';
import {describeRemotableTest} from './utils/remotable-tests';
import {repositoryForPath} from '../pkg/nuclide-vcs-base';
import {waitsForRepositoryReady} from './utils/diff-view-utils';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {
  SHOW_UNCOMMITTED_CHANGES_KIND_CONFIG_KEY,
  ShowUncommittedChangesKind,
} from '../pkg/nuclide-file-tree/lib/Constants';

const {AmendMode} = hgConstants;

describeRemotableTest(
  'Mercurial File Changes Tree Integration Tests',
  (context: TestContext) => {
    let repoPath: string = (null: any);
    let repoRemotePath: string = (null: any);
    let hgRepository: HgRepositoryClient = (null: any);
    // Revision info for creating bookmarks stemming from these revisions
    let firstRevision: RevisionInfo = (null: any);

    beforeEach(() => {
      // Waiting for the UI to update is slow...
      jasmine.getEnv().defaultTimeoutInterval = 25000;
      featureConfig.set(
        SHOW_UNCOMMITTED_CHANGES_KIND_CONFIG_KEY,
        ShowUncommittedChangesKind.UNCOMMITTED,
      );

      waitsForPromise(async () => {
        // Set up repo and handles to file tree DOM nodes
        repoPath = await generateHgRepo1Fixture();
        await context.setProject(repoPath);
        repoRemotePath = context.getProjectRelativePath('');
        hgRepository = ((repositoryForPath(
          repoRemotePath,
        ): any): HgRepositoryClient);
        invariant(
          hgRepository != null,
          'HgRepositoryClient should recognize the project directory as a mercurial project',
        );
        // For later use in creating a bookmark stemming from firstRevision
        firstRevision = await hgRepository.getBaseRevision();
        await waitsForRepositoryReady(repoRemotePath);
      });
    });
    // This is the Mercurial history being built in this test.
    // * Edit test.txt
    // * commit
    // * Add new.txt
    // * amend (edit test.txt and add new.txt now in same commit)
    // * edit new.txt, commit
    // * make bookmark `new` at current commit
    // * make bookmark `other` starting from original commit in hg_repo_1
    // * update to `other` and add other.txt and commit
    // * update back to `new` bookmark
    // * and check that the file tree updates for each step.
    //
    // o  b7fd98  reesjones  other
    // |  add other.txt
    // |
    // | @  dcfbb5  reesjones  new*
    // | |  edit new.txt
    // | |
    // | o  4450ea  reesjones
    // |/   forgot to add new.txt
    // |
    // o  c1c235  jonaldislarry
    // |  second commit
    // ~

    it('can update the file tree UI when Mercurial commit, amend, and bookmark ops are made', () => {
      waitsForPromise(async () => {
        // Make a change
        const filename = nuclideUri.join(repoPath, 'test.txt');
        await fsPromise.writeFile(filename, 'editing test.txt', 'utf8');
      });

      waitsFor('file tree *directories* to update as modified', () => {
        const modified = atom.views
          .getView(atom.workspace)
          .querySelectorAll('.nuclide-file-tree .directory.status-modified');
        const names = Array.from(modified).map(node =>
          nullthrows(node.innerText).trim(),
        );

        return shallowEqual(names, [nuclideUri.basename(repoPath)]);
      });

      waitsFor('file tree *files* to update as modified', () => {
        const modified = atom.views
          .getView(atom.workspace)
          .querySelectorAll('.nuclide-file-tree .file.status-modified');
        const names = Array.from(modified).map(node =>
          nullthrows(node.innerText).trim(),
        );

        return shallowEqual(names, ['test.txt']);
      });

      waitsForPromise({label: 'commit edited file'}, async () => {
        await hgRepository
          .commit('edited test.txt')
          .toArray()
          .toPromise();
      });

      waitsFor('file tree to remove all modified status', () => {
        // There should no longer be any modified nodes in the file tree
        const modified = atom.views
          .getView(atom.workspace)
          .querySelectorAll('.nuclide-file-tree .status-modified');
        const names = Array.from(modified).map(node =>
          nullthrows(node.innerText).trim(),
        );

        return shallowEqual(names, []);
      });

      waitsForPromise({label: 'add new file and add to hg'}, async () => {
        // Add new.txt
        const filename = nuclideUri.join(repoPath, 'new.txt');
        await fsPromise.writeFile(
          filename,
          'adding text to new file: new.txt',
          'utf8',
        );
        // Add it to mercurial
        await hgRepository.addAll([context.getProjectRelativePath('new.txt')]);
      });

      waitsFor('file tree to add and color the new file', () => {
        // Get file tree node and check that one of the <li>'s have .status-added
        const added = atom.views
          .getView(atom.workspace)
          .querySelectorAll('.nuclide-file-tree .list-tree .status-added');
        const names = Array.from(added).map(node =>
          nullthrows(node.innerText).trim(),
        );

        return shallowEqual(names, []);
      });

      waitsForPromise({label: 'amend commit'}, async () => {
        // Amending in Nuclide adds uncommitted changes to the previous commit, so we test that
        // doing an amend removes all .status-added and .status-modified classes from the file tree

        // Amend commit
        await hgRepository
          .amend('forgot to add new.txt', AmendMode.CLEAN)
          .toArray()
          .toPromise();
      });

      waitsFor('file tree to remove *added* status after amend', () => {
        const added = atom.views
          .getView(atom.workspace)
          .querySelectorAll('.nuclide-file-tree .status-added');
        const names = Array.from(added).map(node =>
          nullthrows(node.innerText).trim(),
        );

        return shallowEqual(names, []);
      });

      waitsFor('file tree to remove *modified* status after amend', () => {
        const modified = atom.views
          .getView(atom.workspace)
          .querySelectorAll('.nuclide-file-tree .status-modified');
        const names = Array.from(modified).map(node =>
          nullthrows(node.innerText).trim(),
        );

        return shallowEqual(names, []);
      });

      waitsForPromise({label: 'Make some changes and commit'}, async () => {
        const filename = nuclideUri.join(repoPath, 'new.txt');
        await fsPromise.writeFile(
          filename,
          'adding changes to new.txt',
          'utf8',
        );
        await hgRepository.addAll([repoPath]);
        await hgRepository
          .commit('edit new.txt')
          .toArray()
          .toPromise();
        const laterRevision = await hgRepository.getBaseRevision();

        // Make 'new' bookmark at laterRevision and 'other' bookmark at firstRevision
        await hgRepository.createBookmark('new', laterRevision.hash);
        await hgRepository.createBookmark('other', firstRevision.hash);
        // update to that bookmark
        await hgRepository
          .checkoutReference('other', false)
          .toArray()
          .toPromise();
      });

      waitsFor('file tree to update after updating to `other` bookmark', () => {
        // Make sure file tree doesn't show new.txt
        // Only .watchmanconfig and test.txt exist in firstRevision
        const files = atom.views
          .getView(atom.workspace)
          .querySelectorAll('.nuclide-file-tree .file');
        const names = Array.from(files).map(node =>
          nullthrows(node.innerText).trim(),
        );

        return shallowEqual(names, ['.watchmanconfig', 'test.txt']);
      });

      waitsForPromise(
        {label: 'From `other` bookmark, add other.txt and commit'},
        async () => {
          const filename = nuclideUri.join(repoPath, 'other.txt');
          await fsPromise.writeFile(
            filename,
            'this file created in the `other` bookmark',
            'utf8',
          );
          await hgRepository.addAll([repoPath]);
          await hgRepository
            .commit('add other.txt')
            .toArray()
            .toPromise();
          // Update to 'new' bookmark to see if file tree updates list of files
          await hgRepository
            .checkoutReference('new', false)
            .toArray()
            .toPromise();
        },
      );

      waitsFor(
        'file tree to update after updating back to `new` bookmark',
        () => {
          // Make sure file tree shows new.txt and doesn't show other.txt
          const files = atom.views
            .getView(atom.workspace)
            .querySelectorAll('.nuclide-file-tree .file');
          const names = Array.from(files).map(node =>
            nullthrows(node.innerText).trim(),
          );

          return shallowEqual(names, [
            '.watchmanconfig',
            'new.txt',
            'test.txt',
          ]);
        },
      );
    });
  },
);
