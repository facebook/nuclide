/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */

import invariant from 'assert';
import FuzzyFileNameProvider from '../lib/FuzzyFileNameProvider';
import * as remoteConnection from '../../nuclide-remote-connection';
import * as goToLocationModule from 'nuclide-commons-atom/go-to-location';

describe('FuzzyFileNameProvider', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('executeQuery()', () => {
    // $FlowIgnore
    const mockLocalDirectory: any = {
      getPath() {
        return '/some/local/path';
      },
    };

    it('returns an empty array for an empty query', async () => {
      const results = await FuzzyFileNameProvider.executeQuery(
        '',
        mockLocalDirectory,
      );
      expect(results).toEqual([]);
    });

    describe('callbacks', () => {
      const cannedResults = Promise.resolve([
        {path: '/a/b/c/', score: 0.5, matchIndexes: [1, 2, 3]},
        {path: '/d/e/f/', score: 0.3, matchIndexes: [4, 5]},
      ]);
      const fakeService = {
        // $FlowIgnore
        queryFuzzyFile(x: any) {
          return cannedResults;
        },
      };

      beforeEach(() => {
        jest
          .spyOn(remoteConnection, 'getFuzzyFileSearchServiceByNuclideUri')
          .mockReturnValue(fakeService);
      });

      it('goes to the right location on clickthrough', async () => {
        const goToLocationSpy = jest.spyOn(goToLocationModule, 'goToLocation');
        const query = 'lifesizeshark:10:22';
        const results = await FuzzyFileNameProvider.executeQuery(
          query,
          mockLocalDirectory,
        );
        expect(results.length).toBe(2);
        expect(goToLocationSpy).not.toHaveBeenCalled();
        invariant(results[1].callback, 'should have a callback');
        results[1].callback();
        // Line and column are 1 less because they're 0 indexed in goToLocation
        expect(goToLocationSpy).toHaveBeenCalledWith('/d/e/f/', {
          line: 9,
          column: 21,
        });
      });
    });
  });
});
