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
import {
  MultiMap,
  firstOfIterable,
  filterIterable,
  keyMirror,
} from 'nuclide-commons/collection';
import {createSelector} from 'reselect';

export type RevisionTree = {
  info: RevisionInfo,
  children: Array<RevisionTree>,
};

export const RevisionPreviews = Object.freeze(
  keyMirror({
    HIDDEN: null,
    FOLD: null,
    OPTIMISTIC_FOLD: null,
    REBASE_ROOT: null,
    REBASE_DESCENDANT: null,
    REBASE_OLD: null,
    BULK_REBASE_ROOT: null,
    STRIP_ROOT: null,
    STRIP_DESCENDANT: null,
    COMMIT_LIST_PREVIEW: null,
    OPTIMISTIC_REBASE_ROOT: null,
    OPTIMISTIC_REBASE_DESCENDANT: null,
    CHECKOUT_WAS_HERE: null,
    CHECKOUT_MOVING_HERE: null,
  }),
);
export type RevisionPreview = $Values<typeof RevisionPreviews>;

export function getChildPreviewType(
  previewType: ?RevisionPreview,
): ?RevisionPreview {
  switch (previewType) {
    case RevisionPreviews.REBASE_ROOT:
      return RevisionPreviews.REBASE_DESCENDANT;
    case RevisionPreviews.BULK_REBASE_ROOT:
      return RevisionPreviews.REBASE_DESCENDANT;
    case RevisionPreviews.STRIP_ROOT:
      return RevisionPreviews.STRIP_DESCENDANT;
    case RevisionPreviews.OPTIMISTIC_REBASE_ROOT:
      return RevisionPreviews.OPTIMISTIC_REBASE_DESCENDANT;
    case RevisionPreviews.OPTIMISTIC_REBASE_DESCENDANT:
    case RevisionPreviews.REBASE_DESCENDANT:
    case RevisionPreviews.REBASE_OLD:
    case RevisionPreviews.STRIP_DESCENDANT:
      return previewType;
  }
  return null;
}

/**
 * Given a list of revisions from disk, produce a tree capturing the
 * parent/child structure of the revisions.
 *  - Public revisions are always top level (on the main line)
 *  - Public revisions are sorted by ID
 *  - Draft commits are always offshoots of public revisions (never on main line)
 *     - Caveat: if there are no public commits found, use the parent of everything
 *       as if it were a public commit
 *  - If a public commit has no draft children, it is hidden
 *     - ...unless it has a bookmark
 *  - If a revision has multiple children, they are sorted by ID (not hash, not date)
 */
// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getRevisionTree = createSelector(
  [revisionList => revisionList],
  (smartlogRevisions: Array<RevisionInfo>): Array<RevisionTree> => {
    const childNodesByParent = new MultiMap();
    smartlogRevisions.forEach(revision => {
      const [parent] = revision.parents;
      childNodesByParent.add(parent, revision);
    });

    const byIDDecreasing = (a, b) => b.id - a.id;

    const makeTree = (revision: RevisionInfo): RevisionTree => {
      const {hash} = revision;
      const childrenSet = childNodesByParent.get(hash);

      const childrenInfos = [...childrenSet].sort(byIDDecreasing);

      let children = [];
      if (childrenInfos != null) {
        // only make branches off the main line for non-public revisions
        children = childrenInfos
          .filter(child => child.phase !== 'public')
          .map(makeTree);
      }

      return {
        info: revision,
        children,
      };
    };

    const initialRevisions = smartlogRevisions.filter(
      revision => revision.phase === 'public' || revision.parents.length === 0,
    );

    // build tree starting from public revisions, but
    // hide public revisions without non-public children
    return initialRevisions
      .filter(revision => {
        const {isHead, hash, bookmarks, remoteBookmarks} = revision;
        const hasNonPublicChildren =
          firstOfIterable(
            filterIterable(
              childNodesByParent.get(hash),
              rev => rev.phase !== 'public',
            ),
          ) != null;
        return (
          isHead ||
          hasNonPublicChildren ||
          bookmarks.length > 0 ||
          remoteBookmarks.length > 0
        );
      })
      .sort(byIDDecreasing)
      .map(makeTree);
  },
);

export function* walkTreePostorder(
  revisionStructureTree: Array<RevisionTree>,
): Iterator<RevisionTree> {
  for (const node of revisionStructureTree) {
    if (node.children.length > 0) {
      yield* walkTreePostorder(node.children);
    }
    yield node;
  }
}

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getRevisionTreeMap = createSelector(
  [getRevisionTree],
  (trees: Array<RevisionTree>): Map<string, RevisionTree> => {
    const map = new Map();
    for (const node of walkTreePostorder(trees)) {
      map.set(node.info.hash, node);
    }
    return map;
  },
);

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getRevisionTreeMapFromTree = createSelector(
  [trees => trees],
  (trees: Array<RevisionTree>): Map<string, RevisionTree> => {
    const map = new Map();
    for (const node of walkTreePostorder(trees)) {
      map.set(node.info.hash, node);
    }
    return map;
  },
);

export function findInTree(
  revisionTree: Array<RevisionTree>,
  predicate: RevisionTree => boolean,
): ?RevisionTree {
  for (const node of walkTreePostorder(revisionTree)) {
    if (predicate(node)) {
      return node;
    }
  }
  return null;
}

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const getHeadTree = createSelector(
  [trees => trees],
  (trees: Array<RevisionTree>): ?RevisionTree => {
    return findInTree(trees, tree => tree.info.isHead);
  },
);
