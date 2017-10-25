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

import invariant from 'assert';
import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {runCommand} from 'nuclide-commons/process';
import {generateFixture} from 'nuclide-commons/test-helpers';

import {__test__} from '../lib/process/PathSetFactory';
const {getFilesFromGit, getFilesFromHg} = __test__;

describe('PathSetFactory', () => {
  const TRACKED_FILE_BASE = 'tracked.js';
  const UNTRACKED_FILE_BASE = 'untracked.js';
  const IGNORED_FILE_BASE = 'ignored.js';

  let testDir: string;
  let trackedFile: string;
  let untrackedFile: string;
  let ignoredFile: string;

  beforeEach(() => {
    waitsForPromise(async () => {
      const tempDir = await generateFixture('fuzzy-file-search-rpc');
      testDir = fs.realpathSync(tempDir);
      trackedFile = nuclideUri.join(testDir, TRACKED_FILE_BASE);
      untrackedFile = nuclideUri.join(testDir, UNTRACKED_FILE_BASE);
      ignoredFile = nuclideUri.join(testDir, IGNORED_FILE_BASE);
    });
  });

  describe('getFilesFromGit()', () => {
    const setUpGitRepo = async () => {
      // Add a tracked file, ignored file, and untracked file.
      await runCommand('git', ['init'], {cwd: testDir}).toPromise();
      invariant(testDir);
      invariant(trackedFile);
      invariant(ignoredFile);
      invariant(untrackedFile);
      fs.writeFileSync(trackedFile, '');
      fs.writeFileSync(
        nuclideUri.join(testDir, '.gitignore'),
        `.gitignore\n${IGNORED_FILE_BASE}`,
      );
      fs.writeFileSync(ignoredFile, '');
      await runCommand('git', ['add', '*'], {cwd: testDir}).toPromise();
      fs.writeFileSync(untrackedFile, '');
    };

    it('returns tracked and untracked files, but not ignored files.', () => {
      waitsForPromise(async () => {
        await setUpGitRepo();
        const expectedOutput = [TRACKED_FILE_BASE, UNTRACKED_FILE_BASE];
        invariant(testDir);
        const fetchedFiles = await getFilesFromGit(testDir);
        expect(fetchedFiles).toEqual(expectedOutput);
      });
    });
  });

  describe('getFilesFromHg()', () => {
    const setUpHgRepo = async () => {
      // Add a tracked file, ignored file, and untracked file.
      await runCommand('hg', ['init'], {cwd: testDir}).toPromise();
      invariant(testDir);
      invariant(trackedFile);
      invariant(ignoredFile);
      invariant(untrackedFile);
      fs.writeFileSync(trackedFile, '');
      fs.writeFileSync(
        nuclideUri.join(testDir, '.hgignore'),
        `.hgignore\n${IGNORED_FILE_BASE}`,
      );
      fs.writeFileSync(ignoredFile, '');
      await runCommand('hg', ['addremove'], {cwd: testDir}).toPromise();
      fs.writeFileSync(untrackedFile, '');
    };

    it('returns tracked and untracked files, but not ignored files.', () => {
      waitsForPromise({timeout: 15000}, async () => {
        await setUpHgRepo();
        const expectedOutput = [TRACKED_FILE_BASE, UNTRACKED_FILE_BASE];
        invariant(testDir);
        const fetchedFiles = await getFilesFromHg(testDir);
        expect(fetchedFiles).toEqual(expectedOutput);
      });
    });
  });
});
