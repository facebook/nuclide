/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @emails oncall+nuclide
 * @flow strict-local
 * @format
 */
import type {RevisionInfo} from '../../nuclide-hg-rpc/lib/types';

import {getHeadRevision, getHeadToForkBaseRevisions} from '../lib/utils';
import {hgConstants} from '../../nuclide-hg-rpc';

describe('nuclide-hg-repository-client utils', () => {
  const {CommitPhase} = hgConstants;
  const genericRevisionInfo: RevisionInfo = {
    author: '',
    bookmarks: [],
    branch: '',
    date: new Date(),
    description: '',
    hash: '',
    id: -1,
    isHead: false,
    remoteBookmarks: [],
    parents: [],
    phase: CommitPhase.SECRET,
    tags: [],
    title: '',
    files: [],
    successorInfo: null,
  };
  const nonHeadRevision: RevisionInfo = {
    ...genericRevisionInfo,
    isHead: false,
    hash: 'nonHead',
  };
  const headRevision: RevisionInfo = {
    ...genericRevisionInfo,
    isHead: true,
    hash: 'head',
    parents: ['parent'],
    phase: CommitPhase.DRAFT,
  };
  const parentRevision: RevisionInfo = {
    ...genericRevisionInfo,
    isHead: false,
    hash: 'parent',
    parents: ['base'],
    phase: CommitPhase.DRAFT,
  };
  const baseRevision: RevisionInfo = {
    ...genericRevisionInfo,
    isHead: false,
    hash: 'base',
    phase: CommitPhase.PUBLIC,
    parents: ['parentOfBase'],
  };
  const parentOfBaseRevision: RevisionInfo = {
    ...genericRevisionInfo,
    isHead: false,
    hash: 'parentOfBase',
    phase: CommitPhase.PUBLIC,
    parents: [],
  };

  describe('getHeadRevision', () => {
    it('returns null when no head exists', () => {
      const result = getHeadRevision([nonHeadRevision, nonHeadRevision]);
      expect(result).not.toBe(expect.anything());
    });
    it('handles empty arrays', () => {
      const result = getHeadRevision([]);
      expect(result).not.toBe(expect.anything());
    });
    it('finds correct head revision', () => {
      const result = getHeadRevision([nonHeadRevision, headRevision]);
      expect(result).toBe(headRevision);
    });
  });

  describe('getHeadToForkBaseRevisions', () => {
    it('returns empty array given an empty array', () => {
      const result = getHeadToForkBaseRevisions([]);
      expect(result).toEqual([]);
    });
    it('returns empty array, if no head revision exists', () => {
      const result = getHeadToForkBaseRevisions([parentRevision, baseRevision]);
      expect(result).toEqual([]);
    });
    it('returns the fork in order of base to head', () => {
      const result = getHeadToForkBaseRevisions([
        parentRevision,
        headRevision,
        baseRevision,
      ]);
      expect(result).toEqual([baseRevision, parentRevision, headRevision]);
    });
    it('has the fork base as the only public commit', () => {
      const result = getHeadToForkBaseRevisions([
        parentRevision,
        headRevision,
        baseRevision,
        parentOfBaseRevision,
      ]);
      expect(result).toEqual([baseRevision, parentRevision, headRevision]);
    });
  });
});
