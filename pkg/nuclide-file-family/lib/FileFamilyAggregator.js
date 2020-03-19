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

import type {Observable} from 'rxjs';
import type {
  FileGraph,
  FileFamilyProvider,
  Relation,
  RelatedFile,
  FileMap,
} from './types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {setUnion} from 'nuclide-commons/collection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export default class FileFamilyAggregator {
  _disposables: UniversalDisposable;
  _providers: Set<FileFamilyProvider>;

  constructor(providers: Observable<Set<FileFamilyProvider>>) {
    this._disposables = new UniversalDisposable(
      providers.subscribe(providersValue => (this._providers = providersValue)),
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  async getRelatedFiles(path: NuclideUri): Promise<FileGraph> {
    const allRelatedFiles = await Promise.all(
      [...this._providers].map(provider => provider.getRelatedFiles(path)),
    );

    const allFiles = new Map();
    const directedAdjacencyMatrix = new Map();
    const undirectedAdjacencyMatrix = new Map();

    allRelatedFiles.forEach(({files, relations}) => {
      files.forEach((fileData, filePath) =>
        addRelatedFiletoFileMap(filePath, fileData, allFiles),
      );

      // Combine labels for all directed relations with identical from and to fields
      // Also combine labels for all undirected relations, regardless of from and to
      relations.forEach(relation => {
        if (relation.directed) {
          addRelationToAdjacencyMatrix(relation, directedAdjacencyMatrix);
        } else {
          const existingReverse = undirectedAdjacencyMatrix.get(relation.to);
          if (existingReverse != null && existingReverse.has(relation.from)) {
            const reverse = {
              from: relation.to,
              to: relation.from,
              labels: relation.labels,
              directed: relation.directed,
            };
            addRelationToAdjacencyMatrix(reverse, undirectedAdjacencyMatrix);
          } else {
            addRelationToAdjacencyMatrix(relation, undirectedAdjacencyMatrix);
          }
        }
      });
    });

    const allRelations = [];
    directedAdjacencyMatrix.forEach(map =>
      map.forEach(relation => allRelations.push(relation)),
    );
    undirectedAdjacencyMatrix.forEach(map =>
      map.forEach(relation => allRelations.push(relation)),
    );

    return {
      files: allFiles,
      relations: allRelations,
    };
  }
}

function addRelatedFiletoFileMap(
  filePath: NuclideUri,
  fileData: RelatedFile,
  fileMap: FileMap,
): void {
  const existingFileData = fileMap.get(filePath);
  if (existingFileData == null) {
    fileMap.set(filePath, fileData);
    return;
  }

  const newFileData = {};
  newFileData.labels = setUnion(existingFileData.labels, fileData.labels);
  if (existingFileData.exists != null || fileData.exists != null) {
    // We want to optimistically trust any provider that says the file exists
    // i.e., true > false > undefined
    newFileData.exists =
      Boolean(existingFileData.exists) || Boolean(fileData.exists);
  }
  if (existingFileData.creatable != null || fileData.creatable != null) {
    // We want to trust that any provider saying that a file is not creatable
    // knows what it's talking about
    // i.e., false > true > undefined
    newFileData.creatable = !(
      existingFileData.creatable === false || fileData.creatable === false
    );
  }
  fileMap.set(filePath, newFileData);
}

function addRelationToAdjacencyMatrix(
  relation: Relation,
  adjacencyMatrix: Map<NuclideUri, Map<NuclideUri, Relation>>,
): void {
  const existingRelationFrom = adjacencyMatrix.get(relation.from);
  if (existingRelationFrom == null) {
    adjacencyMatrix.set(relation.from, new Map([[relation.to, relation]]));
    return;
  }
  const existingRelationTo = existingRelationFrom.get(relation.to);
  if (existingRelationTo == null) {
    existingRelationFrom.set(relation.to, relation);
    return;
  }
  // now we know that directed, from, and to are all equal
  const combinedRelation = {
    from: relation.from,
    to: relation.to,
    labels: setUnion(relation.labels, existingRelationTo.labels),
    directed: relation.directed,
  };
  existingRelationFrom.set(relation.to, combinedRelation);
}
