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

import nuclideUri from 'nuclide-commons/nuclideUri';
import {generateFixture} from '../../nuclide-test-helpers';

import findHgRepository from '../lib/hg-repository';

describe('findHgRepository', () => {
  it('finds an hg repo without an hgrc', () => {
    waitsForPromise(async () => {
      const fixturePath = await generateFixture(
        'hg-repo',
        new Map([['a/b/.hg/fakefile', ''], ['a/b/c/d/e', '']]),
      );
      expect(
        findHgRepository(nuclideUri.join(fixturePath, 'a/b/c/d')),
      ).toEqual({
        repoPath: nuclideUri.join(fixturePath, 'a/b/.hg'),
        originURL: null,
        workingDirectoryPath: nuclideUri.join(fixturePath, 'a/b'),
      });
    });
  });

  it('finds an hg repo with an hgrc', () => {
    waitsForPromise(async () => {
      const fixturePath = await generateFixture(
        'hg-repo',
        new Map([
          ['a/b/.hg/hgrc', '[paths]\ndefault = foo'],
          ['a/b/c/d/e', ''],
        ]),
      );
      expect(
        findHgRepository(nuclideUri.join(fixturePath, 'a/b/c/d')),
      ).toEqual({
        repoPath: nuclideUri.join(fixturePath, 'a/b/.hg'),
        originURL: 'foo',
        workingDirectoryPath: nuclideUri.join(fixturePath, 'a/b'),
      });
    });
  });

  it('finds the first hg repo', () => {
    waitsForPromise(async () => {
      const fixturePath = await generateFixture(
        'hg-repo',
        new Map([['a/b/.hg/hgrc', ''], ['a/.hg/hgrc', ''], ['a/b/c/d/e', '']]),
      );
      expect(
        findHgRepository(nuclideUri.join(fixturePath, 'a/b/c/d')),
      ).toEqual({
        repoPath: nuclideUri.join(fixturePath, 'a/b/.hg'),
        originURL: null,
        workingDirectoryPath: nuclideUri.join(fixturePath, 'a/b'),
      });
    });
  });

  it('works with no hg repo', () => {
    waitsForPromise(async () => {
      const fixturePath = await generateFixture(
        'hg-repo',
        new Map([['a/b/.git/fakefile', ''], ['a/b/c/d/e', '']]),
      );
      expect(findHgRepository(nuclideUri.join(fixturePath, 'a/b/c/d'))).toBe(
        null,
      );
    });
  });
});
