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
import {generateFixture} from 'nuclide-commons/test-helpers';
import * as watchmanHelpers from 'nuclide-watchman-helpers';
import {fileSearchForDirectory} from '../lib/process/FileSearch';
import invariant from 'assert';

export function aFileSearchShould(
  typename: string,
  dirPathFn: () => Promise<string>,
) {
  describe(`A ${typename} folder`, () => {
    let dirPath;

    // Don't create a real PathSearchUpdater that relies on watchman.
    const mockPathSetUpdater: Object = {
      startUpdatingPathSet: () => Promise.resolve({dispose: () => {}}),
    };

    beforeEach(async () => {
      // Block Watchman usage by preventing client creation.
      jest.spyOn(watchmanHelpers, 'WatchmanClient').mockImplementation(() => {
        throw new Error();
      });
      dirPath = await dirPathFn();
    });

    // Score values are difficult to test.
    function values(results) {
      return results.map(x => x.path);
    }

    // Correct for dirPath, which is essentially a random string.
    function indexes(results) {
      return results.map(x =>
        x.matchIndexes.map(idx => idx - dirPath.length - 1),
      );
    }

    describe('a FileSearch at the root of a project', () => {
      let search;
      beforeEach(async () => {
        await (async () => {
          search = await fileSearchForDirectory(dirPath, mockPathSetUpdater);
        })();
      });

      it('should return an easy match in the root directory', async () => {
        invariant(search);
        invariant(dirPath);
        const results = await search.query('test');
        expect(values(results)).toEqual([nuclideUri.join(dirPath, 'test')]);
        expect(indexes(results)).toEqual([[0, 1, 2, 3]]);
      });

      it('should return an easy match in the deeper directory', async () => {
        invariant(search);
        invariant(dirPath);
        const results = await search.query('deeper');
        expect(values(results)).toEqual([
          nuclideUri.join(dirPath, 'deeper/deeper'),
        ]);
        expect(indexes(results)).toEqual([[7, 8, 9, 10, 11, 12]]);
      });

      it('should handle searches for full paths', async () => {
        const fullpath = nuclideUri.join(dirPath, 'deeper/deeper');
        let results = await search.query(fullpath);
        expect(values(results)).toEqual([fullpath]);
        results = await search.query(
          nuclideUri.join(nuclideUri.basename(dirPath), 'deeper/deeper'),
        );
        expect(values(results)).toEqual([fullpath]);
      });
    });

    describe('a subdirectory FileSearch', () => {
      let deeperSearch;
      beforeEach(async () => {
        deeperSearch = await fileSearchForDirectory(
          nuclideUri.join(dirPath, 'deeper'),
          mockPathSetUpdater,
        );
      });

      it('should return results relative to the deeper path', async () => {
        invariant(deeperSearch);
        invariant(dirPath);
        const results = await deeperSearch.query('deeper');
        expect(values(results)).toEqual([
          nuclideUri.join(dirPath, 'deeper/deeper'),
        ]);
        expect(indexes(results)).toEqual([[7, 8, 9, 10, 11, 12]]);
      });

      it('should not return results in a subdirectory', async () => {
        invariant(deeperSearch);
        const results = await deeperSearch.query('test');
        expect(results).toEqual([]);
      });
    });

    describe('a FileSearch with ignoredNames', () => {
      let search;
      beforeEach(async () => {
        search = await fileSearchForDirectory(dirPath, mockPathSetUpdater, [
          'deeper/**',
        ]);
      });

      it("should not match ignored patterns if it's not an exact-match", async () => {
        const results = await search.query('');
        expect(values(results)).toEqual([nuclideUri.join(dirPath, 'test')]);
      });

      it('should match ignored patterns if it is an exact-match', async () => {
        if (typename === 'Vanilla (No VCS)') {
          // This test makes no sense for Vanilla searches =)
          return;
        }

        const querySuites = [
          './ignored',
          'ignored',
          nuclideUri.join(dirPath, 'ignored'),
        ];
        for (const querySuite of querySuites) {
          // eslint-disable-next-line no-await-in-loop
          const results = await search.query(querySuite);
          expect(values(results)).toEqual([
            nuclideUri.join(dirPath, 'ignored'),
          ]);
        }
      });
    });
  });
}

export async function createTestFolder(): Promise<string> {
  const folder = await generateFixture(
    'fuzzy-file-search-rpc',
    new Map([['project/test', ''], ['project/deeper/deeper', '']]),
  );
  // The basename of the root folder is included for search purposes.
  // Since fixtures have random folders, add a top level "project" dir
  // to prevent this from causing false search results.
  return nuclideUri.join(folder, 'project');
}
