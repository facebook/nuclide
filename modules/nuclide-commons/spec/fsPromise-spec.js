/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import nuclideUri from 'nuclide-commons/nuclideUri';
import fsPromise from 'nuclide-commons/fsPromise';
import {generateFixture} from '../../../pkg/nuclide-test-helpers';

describe('fsPromise test suite', () => {
  describe('findNearestFile()', () => {
    let dirPath: string = (null: any);

    beforeEach(() => {
      waitsForPromise(async () => {
        dirPath = await generateFixture(
          'nearest_test',
          new Map([
            ['.some_file', 'just some file'],
            ['nested_dir/.another_file', 'just another file'],
          ]),
        );
      });
    });

    it('find the file if given the exact directory', () => {
      waitsForPromise(async () => {
        const foundPath = await fsPromise.findNearestFile(
          '.some_file',
          dirPath,
        );
        expect(foundPath).toBe(dirPath);
      });
    });

    it('find the file if given a nested directory', () => {
      waitsForPromise(async () => {
        const foundPath = await fsPromise.findNearestFile(
          '.some_file',
          nuclideUri.join(dirPath, 'nested_dir'),
        );
        expect(foundPath).toBe(dirPath);
      });
    });

    it('does not find the file if not existing', () => {
      waitsForPromise(async () => {
        const foundPath = await fsPromise.findNearestFile(
          'non-existent.txt',
          nuclideUri.join(dirPath, 'nested_dir'),
        );
        expect(foundPath).toBe(null);
      });
    });
  });

  describe('findFurthestFile()', () => {
    let dirPath: string = (null: any);

    beforeEach(() => {
      waitsForPromise(async () => {
        dirPath = await generateFixture(
          'furthest_test',
          new Map([
            ['0/.some_file', 'just a file'],
            ['0/1/.some_file', 'just b file'],
            // Skip one file to test consecutive vs non-consecutive.
            // ['0/1/2', 'just c file'],
            ['0/1/2/3/.some_file', 'just d file'],
            ['0/1/2/3/4/.some_file', 'just f file'],
          ]),
        );
      });
    });

    it('find the file if given the exact directory', () => {
      waitsForPromise(async () => {
        const expectedPath = nuclideUri.join(dirPath, '0');
        const foundPath = await fsPromise.findFurthestFile(
          '.some_file',
          expectedPath,
        );
        expect(foundPath).toBe(expectedPath);
      });
    });

    it('finds the furthest file if given a nested directory', () => {
      waitsForPromise(async () => {
        const expectedPath = nuclideUri.join(dirPath, '0');
        const startPath = nuclideUri.join(dirPath, '0/1/2/3/4');
        const foundPath = await fsPromise.findFurthestFile(
          '.some_file',
          startPath,
        );
        expect(foundPath).toBe(expectedPath);
      });
    });

    it('terminates search as soon as file is not found if given the stopOnMissing flag', () => {
      waitsForPromise(async () => {
        const expectedPath = nuclideUri.join(dirPath, '0/1/2/3');
        const startPath = nuclideUri.join(dirPath, '0/1/2/3/4');
        const foundPath = await fsPromise.findFurthestFile(
          '.some_file',
          startPath,
          true /* stopOnMissing */,
        );
        expect(foundPath).toBe(expectedPath);
      });
    });

    it('does not find the file if not existing', () => {
      waitsForPromise(async () => {
        const startPath = nuclideUri.join(dirPath, '0/1/2/3/4');
        const foundPath = await fsPromise.findFurthestFile(
          'non-existent.txt',
          startPath,
        );
        expect(foundPath).toBe(null);
      });
    });
  });

  describe('getCommonAncestorDirectory', () => {
    it('gets the parent directory', () => {
      expect(
        fsPromise.getCommonAncestorDirectory([
          '/foo/bar.txt',
          '/foo/baz/lol.txt',
        ]),
      ).toBe('/foo');
      expect(
        fsPromise.getCommonAncestorDirectory([
          '/foo/bar/abc/def/abc.txt',
          '/foo/bar/lol.txt',
        ]),
      ).toBe('/foo/bar');
    });
  });
});
