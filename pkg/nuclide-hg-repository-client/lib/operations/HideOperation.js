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
import {ButtonTypes} from 'nuclide-commons-ui/Button';
import {pluralize} from 'nuclide-commons/string';
import {
  RevisionPreviews,
  getRevisionTreeMapFromTree,
  walkTreePostorder,
  getRevisionTreeMap,
} from '../revisionTree/RevisionTree';

import {Observable} from 'rxjs';

export class HgHideOperation implements HgOperation {
  _hash: string;
  _affectedHashes: Set<string>; // includes this._hash

  constructor(revisions: Array<RevisionInfo>, hash: string) {
    this._hash = hash;

    // find all children that will be affected
    this._affectedHashes = new Set();
    const treeMap = getRevisionTreeMap(revisions);
    const tree = treeMap.get(hash);
    if (tree != null) {
      for (const subtree of walkTreePostorder([tree])) {
        this._affectedHashes.add(subtree.info.hash);
      }
    }
  }

  name = 'hide';

  getArgs() {
    return ['hide', this._hash];
  }

  getEquivalentCommand() {
    return `hg hide ${this._hash}`;
  }

  getCommandDocumentation() {
    const numberOfRevisionsToStrip = this._affectedHashes.size;
    const pluralizedCommits = pluralize('commit', numberOfRevisionsToStrip);
    return {
      naturalLanguageDescription:
        'Removes the commit and all of its descendants',
      confirmationButtonType: ButtonTypes.ERROR,
      confirmationButtonText: `Hide ${pluralizedCommits}`,
      confirmationMessage:
        'Are you sure you want to remove ' +
        (numberOfRevisionsToStrip === 1
          ? 'this'
          : `these ${numberOfRevisionsToStrip}`) +
        ` ${pluralizedCommits}?`,
    };
  }

  makePreviewApplier(
    baseTree: Array<RevisionTree>,
  ): TreePreviewApplierFunction {
    const hash = this._hash;
    const func: TreePreviewApplierFunction = (
      tree: RevisionTree,
      nodePreviewType: ?RevisionPreview,
    ) => {
      if (tree.info.hash === hash) {
        return [tree.children, RevisionPreviews.STRIP_ROOT];
      }
      return [tree.children, nodePreviewType];
    };
    return func;
  }

  makeOptimisticStateApplier(
    treeObservable: Observable<Array<RevisionTree>>,
  ): Observable<?ReportedOptimisticState> {
    const hash = this._hash;
    const func: TreePreviewApplierFunction = (
      tree: RevisionTree,
      nodePreviewType: ?RevisionPreview,
    ) => {
      if (tree.info.hash === hash) {
        // hide this subtree entirely
        return [[], RevisionPreviews.HIDDEN];
      }
      return [tree.children, nodePreviewType];
    };

    return treeObservable
      .takeWhile(trees => {
        const treeMap = getRevisionTreeMapFromTree(trees);
        // only apply optimistic state while the original commit is visible
        return treeMap.get(hash) != null;
      })
      .mapTo({optimisticApplier: func});
  }
}
