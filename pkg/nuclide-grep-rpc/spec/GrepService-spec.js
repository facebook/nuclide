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

import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {generateFixture} from 'nuclide-commons/test-helpers';
import {grepReplace} from '..';

describe('GrepService.grepReplace', () => {
  let tempDir: string;
  beforeEach(() => {
    waitsForPromise(async () => {
      tempDir = await generateFixture(
        'grepReplace',
        new Map([['test.txt', 'test\ntest2\n'], ['nomatch.txt', 'nomatch']]),
      );
    });
  });

  it('can find and replace matches', () => {
    waitsForPromise(async () => {
      const results = await grepReplace(
        [
          nuclideUri.join(tempDir, 'test.txt'),
          nuclideUri.join(tempDir, 'nomatch.txt'),
          nuclideUri.join(tempDir, 'nonexistent.txt'),
        ],
        /test/g,
        'replace',
      )
        .refCount()
        .toArray()
        .toPromise();

      expect(
        results.sort((a, b) => a.filePath.localeCompare(b.filePath)),
      ).toEqual([
        {
          type: 'success',
          filePath: nuclideUri.join(tempDir, 'nomatch.txt'),
          replacements: 0,
        },
        {
          type: 'error',
          filePath: nuclideUri.join(tempDir, 'nonexistent.txt'),
          message: jasmine.any(String),
        },
        {
          type: 'success',
          filePath: nuclideUri.join(tempDir, 'test.txt'),
          replacements: 2,
        },
      ]);

      expect(
        await fsPromise.readFile(nuclideUri.join(tempDir, 'test.txt'), 'utf8'),
      ).toBe('replace\nreplace2\n');
      expect(
        await fsPromise.readFile(
          nuclideUri.join(tempDir, 'nomatch.txt'),
          'utf8',
        ),
      ).toBe('nomatch');
    });
  });
});
