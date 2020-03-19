/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {RevisionInfo} from '../../../nuclide-hg-rpc/lib/types';
import type {
  HgOperation,
  TreePreviewApplierFunction,
  ReportedOptimisticState,
} from '../HgOperation';
import type {RevisionTree, RevisionPreview} from '../revisionTree/RevisionTree';
import {
  getRevisionTreeMapFromTree,
  RevisionPreviews,
} from '../revisionTree/RevisionTree';
import {Observable} from 'rxjs';
import {arrayFlatten, findInIterable} from 'nuclide-commons/collection';

export const FOLDED_REVISION_PREVIEW_HASH = 'FOLD_PREVIEW_HASH';

export class HgCombineOperation implements HgOperation {
  _commits: Array<string>;
  _message: string;

  constructor(commits: Array<string>, combinedMessage: string) {
    this._commits = commits;
    this._message = combinedMessage;
  }

  name = 'fold';

  getArgs() {
    const from = this._commits[0];
    const to = this._commits[this._commits.length - 1];
    return ['fold', '--exact', `${from}::${to}`, '--message', this._message];
  }

  getEquivalentCommand() {
    const from = this._commits[0];
    const to = this._commits[this._commits.length - 1];
    return `hg fold --exact ${from}::${to}`;
  }

  getCommandDocumentation() {
    return null;
  }

  makeOptimisticStateApplier(
    treeObservable: Observable<Array<RevisionTree>>,
  ): Observable<?ReportedOptimisticState> {
    const from = this._commits[0];
    const to = this._commits[this._commits.length - 1];
    return treeObservable
      .takeWhile(trees => {
        const treeMap = getRevisionTreeMapFromTree(trees);

        const fromTree: ?RevisionTree = treeMap.get(from);
        const toTree: ?RevisionTree = treeMap.get(to);

        // if from and to still exist, the operation has not completed
        return !(fromTree == null && toTree == null);
      })
      .map(tree => {
        return {
          optimisticApplier: this._makeFoldPreviewFunction(
            tree,
            RevisionPreviews.OPTIMISTIC_FOLD,
          ),
        };
      });
  }

  makePreviewApplier(
    baseTree: Array<RevisionTree>,
  ): ?TreePreviewApplierFunction {
    return this._makeFoldPreviewFunction(baseTree, RevisionPreviews.FOLD);
  }

  _makeFoldPreviewFunction(
    baseTree: Array<RevisionTree>,
    previewType: RevisionPreview,
  ) {
    const treeMap = getRevisionTreeMapFromTree(baseTree);
    const foldedRevisionsSet = new Set(this._commits);

    const foldPreviewRevisionInfo = this._getFoldPreviewRevisionInfo(
      treeMap,
      this._commits,
      this._message,
    );
    if (foldPreviewRevisionInfo == null) {
      return null;
    }

    // find the non-fold children of the revisions being folded
    const nonFoldChildren = arrayFlatten(
      this._commits.map(hash => {
        const tree = treeMap.get(hash);
        if (tree == null) {
          return [];
        }
        return tree.children.filter(
          child => !foldedRevisionsSet.has(child.info.hash),
        );
      }),
    );

    const foldPreviewNode = {
      info: foldPreviewRevisionInfo,
      children: nonFoldChildren,
    };

    const func: TreePreviewApplierFunction = (tree, nodePreviewType) => {
      const foldChild = tree.children.find(child =>
        foldedRevisionsSet.has(child.info.hash),
      );
      if (foldChild != null) {
        const children = tree.children.map(child => {
          if (child === foldChild) {
            return foldPreviewNode;
          }
          return child;
        });
        return [children, nodePreviewType];
      }
      if (tree === foldPreviewNode) {
        return [tree.children, previewType];
      }
      return [tree.children, nodePreviewType];
    };
    return func;
  }

  _getFoldPreviewRevisionInfo(
    treeMap: Map<string, RevisionTree>,
    foldedRevisions: Array<string>,
    foldedMessage: string,
  ): ?RevisionInfo {
    const foldedRevisionsSet = new Set(foldedRevisions);
    const [foldBaseHash] = foldedRevisions;

    const headRevision = findInIterable(
      treeMap.values(),
      tree => tree.info.isHead,
    );
    const isFoldPreviewHead =
      headRevision != null && foldedRevisionsSet.has(headRevision.info.hash);

    const foldBase = treeMap.get(foldBaseHash);
    if (foldBase == null) {
      return null;
    }

    return {
      ...foldBase.info,
      // inherit foldBase's id so we sort wherever it was
      isHead: isFoldPreviewHead,
      hash: FOLDED_REVISION_PREVIEW_HASH,
      title: foldedMessage.split('\n')[0],
      description: foldedMessage,
    };
  }
}
