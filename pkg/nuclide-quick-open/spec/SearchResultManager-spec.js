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

import type {GlobalProviderType, FileResult, Provider} from '../lib/types';
import type {ProviderSpec} from '../lib/SearchResultManager';
import type {
  ProviderResults,
  GroupedResult,
  GroupedResults,
} from '../lib/searchResultHelpers';

import nuclideUri from 'nuclide-commons/nuclideUri';

import SearchResultManager from '../lib/SearchResultManager';
import QuickOpenProviderRegistry from '../lib/QuickOpenProviderRegistry';

import {__test__} from '../lib/SearchResultManager';
const {_getOmniSearchProviderSpec} = __test__;

const PROJECT_ROOT1 = nuclideUri.join(__dirname, 'fixtures/root1');
const PROJECT_ROOT2 = nuclideUri.join(__dirname, 'fixtures/root2');
const PROJECT_ROOT3 = nuclideUri.join(__dirname, 'fixtures/root3');

const FakeProvider: GlobalProviderType<FileResult> = {
  providerType: 'GLOBAL',
  name: 'FakeProvider',
  display: {
    title: 'Fake',
    prompt: 'Search FakeProvider',
    canOpenAll: false,
  },
  isEligibleForDirectories: directories => Promise.resolve(true),
  executeQuery: (query, directories) => Promise.resolve([]),
};

const FakeProviderSpec: ProviderSpec = Object.freeze({
  action: '',
  canOpenAll: false,
  debounceDelay: 200,
  name: 'FakeProvider',
  prompt: 'Search FakeProvider',
  title: 'Fake',
  priority: Number.POSITIVE_INFINITY,
});

const TEST_STRINGS = ['yolo', 'foo', 'bar'];
const ExactStringMatchProvider: Provider<FileResult> = Object.freeze({
  providerType: 'GLOBAL',
  name: 'ExactStringMatchProvider',
  display: {
    title: 'ExactString',
    prompt: 'Nothing to see here',
  },
  isEligibleForDirectories: directories => Promise.resolve(true),
  executeQuery: (query, directories) =>
    Promise.resolve(
      TEST_STRINGS.filter(s => s === query).map(s => ({
        resultType: 'FILE',
        path: s,
      })),
    ),
});

// Promise-ify the flux cycle around SearchResultManager::executeQuery.
function querySingleProvider(
  searchResultManager: SearchResultManager,
  query: string,
  providerName: string,
): Promise<GroupedResults> {
  return new Promise((resolve, reject) => {
    searchResultManager.onResultsChanged(() => {
      resolve(searchResultManager.getResults(query, providerName));
    });
    searchResultManager.executeQuery(query);
  });
}

function queryOmniSearchProvider(
  quickOpenProviderRegistry: QuickOpenProviderRegistry,
  searchResultManager: SearchResultManager,
  query: string,
): Promise<GroupedResults> {
  return new Promise((resolve, reject) => {
    let pendingUpdates = quickOpenProviderRegistry.getProviders().length;
    searchResultManager.onResultsChanged(() => {
      if (--pendingUpdates === 0) {
        resolve(
          searchResultManager.getResults(query, 'OmniSearchResultProvider'),
        );
      }
    });
    searchResultManager.executeQuery(query);
  });
}

// Helper to construct expected result objects for a global provider.
function constructSingleProviderResult(
  provider: Provider<any>,
  result: ProviderResults,
): GroupedResults {
  const groupResult: GroupedResult = {
    priority:
      provider.priority != null ? provider.priority : Number.POSITIVE_INFINITY,
    title: provider.display != null ? provider.display.title : provider.name,
    results: {
      global: {...result},
    },
    totalResults: 0,
  };
  return {[provider.name]: groupResult};
}

describe('SearchResultManager', () => {
  let searchResultManager: SearchResultManager = (null: any);
  let quickOpenProviderRegistry: QuickOpenProviderRegistry = (null: any);
  let providersChanged: Promise<void>;

  beforeEach(() => {
    jasmine.useRealClock();
    quickOpenProviderRegistry = new QuickOpenProviderRegistry();
    searchResultManager = new SearchResultManager(quickOpenProviderRegistry);
    providersChanged = new Promise(resolve => {
      return searchResultManager.onProvidersChanged(resolve);
    });
  });

  afterEach(() => {
    searchResultManager.dispose();
  });

  describe('getLastQuery', () => {
    it('should store the raw query', () => {
      expect(searchResultManager.getLastQuery()).toBe(null);
      searchResultManager.executeQuery('aaa');
      expect(searchResultManager.getLastQuery()).toBe('aaa');
      searchResultManager.executeQuery('  aaa  ');
      expect(searchResultManager.getLastQuery()).toBe('  aaa  ');
    });
  });

  describe('getRenderableProviders', () => {
    it('Should return OmniSearchProvider even if no actual providers are available.', () => {
      const renderableProviders = searchResultManager.getRenderableProviders();
      expect(renderableProviders).toEqual([_getOmniSearchProviderSpec()]);
    });
  });

  describe('provider/directory cache', () => {
    it('updates the cache when providers become (un)available', () => {
      waitsForPromise(async () => {
        let providersChangedCallCount = 0;
        searchResultManager.onProvidersChanged(() => {
          providersChangedCallCount++;
        });

        const fakeProviderDisposable = quickOpenProviderRegistry.addProvider(
          FakeProvider,
        );

        // We want to await until updateDirectories has finished, but we don't
        // have access to its returned Promise. So instead we'll await until
        // it finally emits 'providers-changed'.
        await providersChanged;

        let renderableProviders = searchResultManager.getRenderableProviders();
        expect(renderableProviders.length).toEqual(2);
        expect(renderableProviders[1]).toEqual(FakeProviderSpec);
        expect(providersChangedCallCount).toEqual(1);

        // Simulate deactivation of FakeProvider
        // The dispose method has immediate effect: no debouncing, no need to await.
        fakeProviderDisposable.dispose();
        renderableProviders = searchResultManager.getRenderableProviders();
        expect(renderableProviders.length).toEqual(1);
        expect(providersChangedCallCount).toEqual(2);
      });
    });
  });

  describe('querying providers', () => {
    it('queries providers asynchronously, emits change events and returns filtered results', () => {
      waitsForPromise(async () => {
        quickOpenProviderRegistry.addProvider(ExactStringMatchProvider);
        await providersChanged;
        expect(
          await querySingleProvider(
            searchResultManager,
            'yolo',
            'ExactStringMatchProvider',
          ),
        ).toEqual(
          constructSingleProviderResult(ExactStringMatchProvider, {
            results: [
              {
                resultType: 'FILE',
                path: 'yolo',
                sourceProvider: 'ExactStringMatchProvider',
              },
            ],
            loading: false,
            error: null,
          }),
        );
      });
    });

    it('ignores trailing whitespace in querystring.', () => {
      waitsForPromise(async () => {
        quickOpenProviderRegistry.addProvider(ExactStringMatchProvider);
        await providersChanged;
        await Promise.all(
          ['   yolo', 'yolo   ', '   yolo   \n '].map(async query => {
            expect(
              await querySingleProvider(
                searchResultManager,
                query,
                'ExactStringMatchProvider',
              ),
            ).toEqual(
              constructSingleProviderResult(ExactStringMatchProvider, {
                results: [
                  {
                    resultType: 'FILE',
                    path: query.trim(),
                    sourceProvider: 'ExactStringMatchProvider',
                  },
                ],
                loading: false,
                error: null,
              }),
            );
          }),
        );
      });
    });
  });

  describe('OmniSearch provider sorting', () => {
    const FirstProvider: Provider<FileResult> = {
      providerType: 'GLOBAL',
      name: 'FirstProvider',
      priority: 1,
      isEligibleForDirectories: directories => Promise.resolve(true),
      executeQuery: (query, directories) => Promise.resolve([]),
    };
    const SecondProvider: Provider<FileResult> = {
      providerType: 'GLOBAL',
      name: 'SecondProvider',
      priority: 2,
      isEligibleForDirectories: directories => Promise.resolve(true),
      executeQuery: (query, directories) => Promise.resolve([]),
    };
    const ThirdProvider: Provider<FileResult> = {
      providerType: 'GLOBAL',
      name: 'ThirdProvider',
      priority: 3,
      isEligibleForDirectories: directories => Promise.resolve(true),
      executeQuery: (query, directories) => Promise.resolve([]),
    };
    const allResults: GroupedResults = {
      FirstProvider: {
        title: 'FirstProvider',
        priority: 1,
        results: {global: {results: [], loading: false, error: null}},
        totalResults: 0,
      },
      SecondProvider: {
        title: 'SecondProvider',
        priority: 2,
        results: {global: {results: [], loading: false, error: null}},
        totalResults: 0,
      },
      ThirdProvider: {
        title: 'ThirdProvider',
        priority: 3,
        results: {global: {results: [], loading: false, error: null}},
        totalResults: 0,
      },
    };

    it('returns results sorted by priority (1, 3, 2)', () => {
      quickOpenProviderRegistry.addProvider(FirstProvider);
      quickOpenProviderRegistry.addProvider(ThirdProvider);
      quickOpenProviderRegistry.addProvider(SecondProvider);
      waitsForPromise(async () => {
        await providersChanged;
        expect(
          await queryOmniSearchProvider(
            quickOpenProviderRegistry,
            searchResultManager,
            '',
          ),
        ).toEqual(allResults);
      });
    });

    it('returns results sorted by priority (3, 2, 1)', () => {
      quickOpenProviderRegistry.addProvider(ThirdProvider);
      quickOpenProviderRegistry.addProvider(SecondProvider);
      quickOpenProviderRegistry.addProvider(FirstProvider);
      waitsForPromise(async () => {
        await providersChanged;
        expect(
          await queryOmniSearchProvider(
            quickOpenProviderRegistry,
            searchResultManager,
            '',
          ),
        ).toEqual(allResults);
      });
    });
  });

  describe('directory sorting', () => {
    beforeEach(() => {
      waitsForPromise(async () => {
        // Something adds paths automatically. I've seen both the `fixtures` directory and the
        // `spec` directory. Remove them here so they don't pollute the tests below.
        atom.project.getPaths().forEach(path => atom.project.removePath(path));

        atom.project.addPath(PROJECT_ROOT1);
        atom.project.addPath(PROJECT_ROOT2);
        atom.project.addPath(PROJECT_ROOT3);

        await providersChanged;
      });
    });

    describe('with no current working root', () => {
      it('should return the same order as Atom', () => {
        const sortedPaths = searchResultManager
          ._sortDirectories()
          .map(dir => dir.getPath());
        expect(sortedPaths).toEqual([
          PROJECT_ROOT1,
          PROJECT_ROOT2,
          PROJECT_ROOT3,
        ]);
      });
    });

    describe('with a current working root', () => {
      beforeEach(() => {
        // mocking the directory -- if this becomes a problem it shouldn't be too hard to get the
        // actual Directory object from Atom
        const fakeDir: any = {getPath: () => PROJECT_ROOT3};
        searchResultManager.setCurrentWorkingRoot(fakeDir);
      });
      it('should put that root first, without disturbing the relative order of other roots', () => {
        const sortedPaths = searchResultManager
          ._sortDirectories()
          .map(dir => dir.getPath());
        expect(sortedPaths).toEqual([
          PROJECT_ROOT3,
          PROJECT_ROOT1,
          PROJECT_ROOT2,
        ]);
      });
    });
  });
});
