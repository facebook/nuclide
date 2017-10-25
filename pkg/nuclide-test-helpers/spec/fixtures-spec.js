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

import fs from 'fs';
import {copyFixture, copyBuildFixture} from '../lib/fixtures';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';

describe('copyFixture', () => {
  it('should copy a directory recursively', () => {
    waitsForPromise(async () => {
      const copyOfFixture = await copyFixture('fixture-to-copy', __dirname);
      expect(nuclideUri.isAbsolute(copyOfFixture)).toBe(true);

      expect(fs.statSync(copyOfFixture).isDirectory()).toBe(true);

      const file1txt = nuclideUri.join(copyOfFixture, 'file1.txt');
      expect(fs.statSync(file1txt).isFile()).toBe(true);
      expect(fs.readFileSync(file1txt, 'utf8')).toBe('hello\n');

      const dir1 = nuclideUri.join(copyOfFixture, 'dir1');
      expect(fs.statSync(dir1).isDirectory()).toBe(true);

      const file2txt = nuclideUri.join(dir1, 'file2.txt');
      expect(fs.statSync(file2txt).isFile()).toBe(true);
      expect(fs.readFileSync(file2txt, 'utf8')).toBe('world\n');
    });
  });

  it('should find fixtures in parent directories', () => {
    waitsForPromise(async () => {
      const fixtureStartDir = nuclideUri.join(
        __dirname,
        'fixtures/deep1/deep2',
      );
      const copyOfFixture = await copyFixture(
        'fixture-to-find',
        fixtureStartDir,
      );
      expect(nuclideUri.isAbsolute(copyOfFixture)).toBe(true);

      expect(fs.statSync(copyOfFixture).isDirectory()).toBe(true);

      const file1txt = nuclideUri.join(copyOfFixture, 'file1.txt');
      expect(fs.statSync(file1txt).isFile()).toBe(true);
      expect(fs.readFileSync(file1txt, 'utf8')).toBe('beep boop\n');
    });
  });
});

describe('copyBuildFixture', () => {
  it('should rename {BUCK,TARGETS}-rename to {BUCK,TARGETS}', () => {
    waitsForPromise(async () => {
      const buildFixture = await copyBuildFixture('build-fixture', __dirname);
      expect(nuclideUri.isAbsolute(buildFixture)).toBe(true);
      expect(fs.statSync(buildFixture).isDirectory()).toBe(true);
      const renames = await fsPromise.glob('**/*', {
        cwd: buildFixture,
        nodir: true,
      });
      expect(renames).toEqual([
        'BUCK',
        'otherdir/BUCK',
        'otherdir/otherfile',
        'somedir/somefile',
        'somedir/TARGETS',
      ]);
    });
  });
});
