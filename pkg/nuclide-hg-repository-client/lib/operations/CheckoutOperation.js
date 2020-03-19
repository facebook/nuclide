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

import type {
  HgOperation,
  TreePreviewApplierFunction,
  ReportedOptimisticState,
} from '../HgOperation';
import type {RevisionTree, RevisionPreview} from '../revisionTree/RevisionTree';
import {
  getRevisionTreeMapFromTree,
  RevisionPreviews,
  getHeadTree,
} from '../revisionTree/RevisionTree';
import {Observable} from 'rxjs';

export class HgCheckoutOperation implements HgOperation {
  _destination: string; // any revset: hash, bookmark, .^, etc
  _destinationIsBookmark: boolean;

  constructor(destination: string, destinationIsBookmark?: boolean = false) {
    this._destination = destination;
    this._destinationIsBookmark = destinationIsBookmark;
  }

  name = 'checkout';

  getArgs() {
    return ['checkout', this._destination];
  }

  getEquivalentCommand() {
    return 'hg ' + this.getArgs().join(' ');
  }

  getCommandDocumentation() {
    return null;
  }

  makeOptimisticStateApplier(
    treeObservable: Observable<Array<RevisionTree>>,
  ): Observable<?ReportedOptimisticState> {
    const destination = this._destination;
    let lastKnownHeadHash;
    const optimisticApplier: TreePreviewApplierFunction = (
      tree: RevisionTree,
      nodePreviewType: ?RevisionPreview,
    ) => {
      const {info, children} = tree;
      if (this._destinationIsBookmark) {
        if (
          info.bookmarks.includes(destination) ||
          info.remoteBookmarks.includes(destination)
        ) {
          return [children, RevisionPreviews.CHECKOUT_MOVING_HERE];
        }
      } else if (info.hash === destination) {
        return [children, RevisionPreviews.CHECKOUT_MOVING_HERE];
      }
      if (info.isHead) {
        return [children, RevisionPreviews.CHECKOUT_WAS_HERE];
      }
      return [children, nodePreviewType];
    };

    return treeObservable
      .takeWhile(trees => {
        const treeMap = getRevisionTreeMapFromTree(trees);

        if (lastKnownHeadHash == null) {
          lastKnownHeadHash = getHeadTree(trees)?.info?.hash;
        }

        const lastKnownHeadTree: ?RevisionTree = treeMap.get(lastKnownHeadHash);
        // If the last known head is no longer head... the checkout was a success!
        return !(lastKnownHeadTree != null && !lastKnownHeadTree.info.isHead);
      })
      .mapTo({optimisticApplier});
  }
}
