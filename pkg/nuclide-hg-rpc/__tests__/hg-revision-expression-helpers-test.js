/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import {
  expressionForRevisionsBeforeHead,
  parseRevisionInfoOutput,
  INFO_REV_END_MARK,
  NULL_CHAR,
  parseSuccessorData,
} from '../lib/hg-revision-expression-helpers';
import {SuccessorType} from '../lib/hg-constants';

describe('hg-revision-expression-helpers', () => {
  describe('expressionForRevisionsBeforeHead', () => {
    it('returns a correct expression <= 0 revisions before head.', () => {
      expect(expressionForRevisionsBeforeHead(0)).toBe('.');
      expect(expressionForRevisionsBeforeHead(-2)).toBe('.');
    });

    it('returns a correct expression for > 0 revisions before head.', () => {
      expect(expressionForRevisionsBeforeHead(3)).toBe('.~3');
    });
  });

  describe('parseRevisionInfoOutput', () => {
    it('returns the parsed revision info if is valid.', () => {
      const commit1Description = `Commit 1 'title'.
Continue Commit 1 message.`;
      const commit2Description = `Commit 2 'title'.

Still, multi-line commit 2 message

Test Plan: complete`;
      const revisionsString = `124
Commit 1 'title'.
Author Name<auth_2_alias@domain.com>
2015-10-15 16:03 -0700
a343fb3
default
draft
b-1${NULL_CHAR}b-2${NULL_CHAR}

tip${NULL_CHAR}
a343fb211111${NULL_CHAR}000000000000${NULL_CHAR}
@
["temp.txt"]







${commit1Description}
${INFO_REV_END_MARK}
123
Commit 2 'title'.
Author Name<auth_2_alias@domain.com>
2015-10-15 16:02 -0700
a343fb2
default
public

remote/master${NULL_CHAR}

abc123411111${NULL_CHAR}000000000000${NULL_CHAR}

["temp.txt"]

af3435454321





${commit2Description}
${INFO_REV_END_MARK}
`;

      expect(parseRevisionInfoOutput(revisionsString)).toEqual([
        {
          id: 124,
          isHead: true,
          files: ['temp.txt'],
          title: "Commit 1 'title'.",
          author: 'Author Name<auth_2_alias@domain.com>',
          hash: 'a343fb3',
          bookmarks: ['b-1', 'b-2'],
          remoteBookmarks: [],
          date: new Date('2015-10-15 16:03 -0700'),
          branch: 'default',
          phase: 'draft',
          tags: ['tip'],
          parents: ['a343fb211111'],
          description: commit1Description,
          successorInfo: null,
        },
        {
          id: 123,
          isHead: false,
          files: ['temp.txt'],
          title: "Commit 2 'title'.",
          author: 'Author Name<auth_2_alias@domain.com>',
          hash: 'a343fb2',
          bookmarks: [],
          remoteBookmarks: ['remote/master'],
          date: new Date('2015-10-15 16:02 -0700'),
          branch: 'default',
          phase: 'public',
          tags: [],
          parents: ['abc123411111'],
          description: commit2Description,
          successorInfo: {
            hash: 'af3435454321',
            type: SuccessorType.AMEND,
          },
        },
      ]);
    });

    it('skips an entry if invalid - should never happen', () => {
      expect(parseRevisionInfoOutput('revision:123')).toEqual([]);
    });
  });

  describe('parseSuccessorData', () => {
    it('handles multiple successors', () => {
      expect(
        parseSuccessorData([
          '',
          '',
          '',
          '',
          '',
          '',
          '111111111111, 222222222222, 333333333333',
        ]),
      ).toEqual({hash: '111111111111', type: SuccessorType.REWRITTEN});
    });
    it('uses rewritten last', () => {
      expect(
        parseSuccessorData([
          '',
          '',
          '',
          '444444444444',
          '',
          '',
          '111111111111',
        ]),
      ).toEqual({hash: '444444444444', type: SuccessorType.SPLIT});
    });
  });
});
