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

import type {RevisionInfo} from '../../nuclide-hg-rpc/lib/types';

import {hgConstants} from '../../nuclide-hg-rpc';

export function getHeadRevision(revisions: Array<RevisionInfo>): ?RevisionInfo {
  return revisions.find(revision => revision.isHead);
}

export function getHeadToForkBaseRevisions(
  revisions: Array<RevisionInfo>,
): Array<RevisionInfo> {
  // `headToForkBaseRevisions` should have the public commit at the fork base as the first.
  // and the rest of the current `HEAD` stack in order with the `HEAD` being last.
  const headRevision = getHeadRevision(revisions);
  if (headRevision == null) {
    return [];
  }
  const {CommitPhase} = hgConstants;
  const hashToRevisionInfo = new Map(
    revisions.map(revision => [revision.hash, revision]),
  );
  const headToForkBaseRevisions = [];
  let parentRevision = headRevision;
  while (
    parentRevision != null &&
    parentRevision.phase !== CommitPhase.PUBLIC
  ) {
    headToForkBaseRevisions.unshift(parentRevision);
    parentRevision = hashToRevisionInfo.get(parentRevision.parents[0]);
  }
  if (parentRevision != null) {
    headToForkBaseRevisions.unshift(parentRevision);
  }
  return headToForkBaseRevisions;
}
