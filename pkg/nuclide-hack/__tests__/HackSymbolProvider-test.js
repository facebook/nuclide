/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import type {SymbolResult} from '../../nuclide-language-service/lib/LanguageService';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {HackSymbolProvider} from '../lib/HackSymbolProvider';
import {clearRequireCache, uncachedRequire} from 'nuclide-commons/test-helpers';
import invariant from 'assert';

describe('HackSymbolProvider', () => {
  // These tests are set up so that calls to getHackLanguageForUri() will delegate to this
  // function, so make sure to define this function at the start of your test to mock out this
  // behavior.
  let getHackLanguageForUri: ?(directory: NuclideUri) => Promise<mixed>;
  let isFileInProject: ?(directory: NuclideUri) => Promise<boolean>;
  const mockDirectory: atom$Directory = ({getPath: () => 'uri1'}: any);
  const mockDirectory2: atom$Directory = ({getPath: () => 'uri2'}: any);

  beforeEach(() => {
    getHackLanguageForUri = null;
    isFileInProject = null;
    jest
      .spyOn(require('../lib/HackLanguage'), 'getHackLanguageForUri')
      .mockImplementation((directory: NuclideUri) => {
        invariant(getHackLanguageForUri);
        return getHackLanguageForUri(directory);
      });
    jest
      .spyOn(require('../lib/HackLanguage'), 'isFileInHackProject')
      .mockImplementation((directory: NuclideUri) => {
        invariant(isFileInProject);
        return isFileInProject(directory);
      });
    uncachedRequire(require, '../lib/HackSymbolProvider');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearRequireCache(require, '../lib/HackSymbolProvider');
  });

  describe('executeQuery()', () => {
    it('returns an empty array for an empty query', async () => {
      const results = await HackSymbolProvider.executeQuery('', []);
      expect(results).toEqual([]);
    });

    it('local search returns local paths when searching local directories', async () => {
      await (async () => {
        // Set up the HackService to return some canned results.
        const cannedResults = [
          {
            path: '/some/local/path/asdf.txt',
            line: 1,
            column: 42,
            context: 'aha',
          },
        ];
        const hackService = createDummyHackService();
        const supportsMethod = jest
          .spyOn(hackService, 'supportsSymbolSearch')
          .mockReturnValue(true);
        const searchMethod = jest
          .spyOn(hackService, 'symbolSearch')
          .mockReturnValue(cannedResults);
        getHackLanguageForUri = jest.fn().mockReturnValue(hackService);

        // test that SymbolProvider.isEligibleForDirectories
        // calls into HackService.supportsSymbolSearch correctly
        const supports = await HackSymbolProvider.isEligibleForDirectories([
          mockDirectory,
        ]);
        expect(supports).toEqual(true);
        expect(supportsMethod.mock.calls.length).toBe(1);
        expect(supportsMethod.mock.calls[0]).toEqual([
          [mockDirectory.getPath()],
        ]);

        // test that SymbolProvider.executeQuery
        // calls into HackService.symbolSearch correctly
        const query = 'asdf';
        const results = await HackSymbolProvider.executeQuery(query, [
          mockDirectory,
        ]);
        expect(results).toEqual(cannedResults);
        expect(searchMethod.mock.calls.length).toBe(1);
        expect(searchMethod.mock.calls[0]).toEqual([
          query,
          [mockDirectory.getPath()],
        ]);
      })();
    });

    it('remote search returns remote paths when searching remote directories', async () => {
      await (async () => {
        // Set up the HackService to return some canned results.
        const cannedResults = [
          {
            path: 'nuclide://some.host/some/local/path/asdf.txt',
            line: 1,
            column: 42,
            context: 'aha',
          },
        ];
        const hackService = createDummyHackService();
        const searchMethod = jest
          .spyOn(hackService, 'symbolSearch')
          .mockReturnValue(cannedResults);
        getHackLanguageForUri = jest.fn().mockReturnValue(hackService);

        const query = 'asdf';
        const results = await HackSymbolProvider.executeQuery(query, [
          mockDirectory,
        ]);

        // Verify the expected results were returned by delegating to the HackService,
        // and that local file paths are converted to NuclideUris.
        expect(results).toEqual(cannedResults);
        expect(searchMethod.mock.calls.length).toBe(1);
        expect(searchMethod.mock.calls[0]).toEqual([
          query,
          [mockDirectory.getPath()],
        ]);
      })();
    });

    it('should only query once per unique service, not once per directory', async () => {
      await (async () => {
        // Set up the HackService to return some canned results.
        const cannedResults = [
          {
            path: 'nuclide://some.host/some/local/path/asdf.txt',
            line: 1,
            column: 42,
            context: 'aha',
          },
        ];
        const hackService = createDummyHackService();
        const searchMethod = jest
          .spyOn(hackService, 'symbolSearch')
          .mockReturnValue(cannedResults);
        getHackLanguageForUri = jest.fn().mockReturnValue(hackService);
        // both directories return the same service

        const query = 'asdf';
        const results = await HackSymbolProvider.executeQuery(query, [
          mockDirectory,
          mockDirectory2,
        ]);

        // Verify the expected results were returned by delegating to the HackService,
        // and that local file paths are converted to NuclideUris.
        expect(results).toEqual(cannedResults);
        expect(searchMethod.mock.calls.length).toBe(1);
        expect(searchMethod.mock.calls[0]).toEqual([
          query,
          [mockDirectory.getPath(), mockDirectory2.getPath()],
        ]);
      })();
    });

    it('should query once per unique service', async () => {
      await (async () => {
        // Set up the HackService to return some canned results.
        const cannedResults1 = [
          {
            path: 'nuclide://some.host/some/local/path/asdf.txt',
            line: 1,
            column: 42,
            context: 'aha',
          },
        ];
        const cannedResults2 = [
          {
            path: 'nuclide://some.host/other/local/path/asdf.txt',
            line: 2,
            column: 15,
            context: 'hehe',
          },
        ];
        const hackService1 = createDummyHackService();
        const hackService2 = createDummyHackService();
        const searchMethod1 = jest
          .spyOn(hackService1, 'symbolSearch')
          .mockReturnValue(cannedResults1);
        const searchMethod2 = jest
          .spyOn(hackService2, 'symbolSearch')
          .mockReturnValue(cannedResults2);
        getHackLanguageForUri = jest.fn().mockImplementation(uri => {
          return uri === mockDirectory.getPath() ? hackService1 : hackService2;
        });

        const query = 'asdf';
        const results = await HackSymbolProvider.executeQuery(query, [
          mockDirectory,
          mockDirectory2,
        ]);

        // Verify the expected results were returned by delegating to the HackService,
        // and that local file paths are converted to NuclideUris.
        expect(results).toEqual(cannedResults1.concat(cannedResults2));
        expect(searchMethod1.mock.calls.length).toBe(1);
        expect(searchMethod1.mock.calls[0]).toEqual([
          query,
          [mockDirectory.getPath()],
        ]);
        expect(searchMethod2.mock.calls.length).toBe(1);
        expect(searchMethod2.mock.calls[0]).toEqual([
          query,
          [mockDirectory2.getPath()],
        ]);
      })();
    });
  });
});

function createDummyHackService(): any {
  return {
    supportsSymbolSearch(directories: Array<NuclideUri>): Promise<boolean> {
      throw new Error(
        'replace supportsSymbolSearch with implementation for testing',
      );
    },
    symbolSearch(
      queryString: string,
      directories: Array<NuclideUri>,
    ): Promise<Array<SymbolResult>> {
      throw new Error('replace symbolSearch with implementation for testing');
    },
  };
}
