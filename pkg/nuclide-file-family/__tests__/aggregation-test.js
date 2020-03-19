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
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {RelationList, FileMap} from '../lib/types';

import {Observable} from 'rxjs';
import FileFamilyAggregator from '../lib/FileFamilyAggregator';
import {mapUnion, setUnion} from 'nuclide-commons/collection';

const directedProvider = {
  async getRelatedFiles(filePath: NuclideUri) {
    const files: FileMap = new Map();
    files.set(filePath, {
      labels: new Set(),
      exists: true,
      creatable: true,
    });
    files.set('test.js', {
      labels: new Set(['test']),
      creatable: true,
    });

    const relations: RelationList = [
      {
        from: filePath,
        to: 'test.js',
        labels: new Set(['test']),
        directed: true,
      },
    ];

    return {
      files,
      relations,
    };
  },
};

const directedProvider2 = {
  async getRelatedFiles(filePath: NuclideUri) {
    const files: FileMap = new Map();
    files.set(filePath, {
      labels: new Set(),
      exists: true,
      creatable: true,
    });
    files.set('test.js', {
      labels: new Set(['test2']),
      creatable: true,
    });

    const relations: RelationList = [
      {
        from: filePath,
        to: 'test.js',
        labels: new Set(['test2']),
        directed: true,
      },
    ];

    return {
      files,
      relations,
    };
  },
};

const undirectedProvider = {
  async getRelatedFiles(filePath: NuclideUri) {
    const files: FileMap = new Map();
    files.set(`${filePath}2`, {
      labels: new Set(),
      exists: true,
      creatable: true,
    });
    files.set('test2.js', {
      labels: new Set(['test']),
      creatable: true,
    });

    const relations: RelationList = [
      {
        from: `${filePath}2`,
        to: 'test2.js',
        labels: new Set(['test']),
        directed: false,
      },
    ];

    return {
      files,
      relations,
    };
  },
};

describe('aggregation', () => {
  it('combines nothing', async () => {
    const aggregator = new FileFamilyAggregator(Observable.of(new Set()));
    const graph = await aggregator.getRelatedFiles('test');
    expect(Array.from(graph.files)).toEqual(Array.from(new Map()));
    expect(graph.relations).toEqual([]);
  });

  it('combines unique graphs', async () => {
    const aggregator = new FileFamilyAggregator(
      Observable.of(new Set([directedProvider, undirectedProvider])),
    );
    const graph = await aggregator.getRelatedFiles('test');
    const expectedGraph = await directedProvider.getRelatedFiles('test');
    const expectedGraph2 = await undirectedProvider.getRelatedFiles('test');
    expect(Array.from(graph.files)).toEqual(
      Array.from(mapUnion(expectedGraph.files, expectedGraph2.files)),
    );
    expect(graph.relations).toEqual(
      expectedGraph.relations.concat(expectedGraph2.relations),
    );
  });

  it('deduplicates files and combines labels', async () => {
    const aggregator = new FileFamilyAggregator(
      Observable.of(new Set([directedProvider, directedProvider2])),
    );
    const graph = await aggregator.getRelatedFiles('test');
    const expectedGraph = await directedProvider.getRelatedFiles('test');
    expectedGraph.files.set('test.js', {
      labels: new Set(['test', 'test2']),
      creatable: true,
    });
    expect(Array.from(graph.files)).toEqual(Array.from(expectedGraph.files));
  });

  it('deduplicates and combines labels for directed relations', async () => {
    const aggregator = new FileFamilyAggregator(
      Observable.of(new Set([directedProvider, directedProvider2])),
    );
    const graph = await aggregator.getRelatedFiles('test');
    const expectedGraph = await directedProvider.getRelatedFiles('test');
    const expectedGraph2 = await directedProvider2.getRelatedFiles('test');
    expect(graph.relations).toEqual([
      {
        from: expectedGraph.relations[0].from,
        to: expectedGraph.relations[0].to,
        labels: setUnion(
          expectedGraph.relations[0].labels,
          expectedGraph2.relations[0].labels,
        ),
        directed: expectedGraph.relations[0].directed,
      },
    ]);
  });

  it('deduplicates and combines labels for undirected relations', async () => {
    const reverseUndirectedProvider = {
      async getRelatedFiles(filePath: NuclideUri) {
        const files: FileMap = new Map();
        files.set(`${filePath}2`, {
          labels: new Set(),
          exists: true,
          creatable: true,
        });
        files.set('test2.js', {
          labels: new Set(['test']),
          creatable: true,
        });

        const relations: RelationList = [
          {
            from: 'test2.js',
            to: `${filePath}2`,
            labels: new Set(['test2']),
            directed: false,
          },
        ];

        return {
          files,
          relations,
        };
      },
    };

    const aggregator = new FileFamilyAggregator(
      Observable.of(
        new Set([
          undirectedProvider,
          undirectedProvider,
          reverseUndirectedProvider,
        ]),
      ),
    );
    const graph = await aggregator.getRelatedFiles('test');
    const expectedGraph = await undirectedProvider.getRelatedFiles('test');
    expectedGraph.relations[0].labels.add('test2');
    expect(graph.relations).toEqual(expectedGraph.relations);
  });
});
