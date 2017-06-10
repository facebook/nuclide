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

import invariant from 'assert';

import {getPhabricatorRevisionFromCommitMessage} from '../lib/utils';

describe('utils', () => {
  const testCases = [
    [
      'Differential Revision: https://phabricator.intern.facebook.com/D169775',
      {
        id: 169775,
        name: 'D169775',
        url: 'https://phabricator.intern.facebook.com/D169775',
      },
    ],
    ['Some stuff', null],
    [
      `Multiline

      message
      Differential Revision: https://phabricator.intern.facebook.com/d123456
      Test plan: foo!`.replace(/^ +/gm, ''),
      {
        id: 123456,
        name: 'D123456',
        url: 'https://phabricator.intern.facebook.com/d123456',
      },
    ],
  ];
  it('can parse a commit message and get the revision ID', () => {
    for (const [message, correctAnswer] of testCases) {
      const msg = `Test data: '${message}'`;
      const revisionInfo = getPhabricatorRevisionFromCommitMessage(message);
      if (correctAnswer == null) {
        expect(revisionInfo).toBeNull(msg);
      } else {
        expect(revisionInfo).not.toBeNull(msg);
        invariant(revisionInfo != null);
        expect(revisionInfo.id).toBe(correctAnswer.id, msg);
        expect(revisionInfo.name).toBe(correctAnswer.name, msg);
        expect(revisionInfo.url).toBe(correctAnswer.url, msg);
      }
    }
  });
});
