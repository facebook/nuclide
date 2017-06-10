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

import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {generateFixture} from '../../nuclide-test-helpers';
import {applyRefactoring} from '../lib/refactorEpics';

describe('applyRefactoring', () => {
  let testDir;
  let testFile1;
  let testFile2;
  beforeEach(() => {
    waitsForPromise(async () => {
      testDir = await generateFixture(
        'refactoring',
        new Map([['test1.txt', 'abcdefghi'], ['test2.txt', '123456789']]),
      );
      testFile1 = nuclideUri.join(testDir, 'test1.txt');
      testFile2 = nuclideUri.join(testDir, 'test2.txt');
    });
  });

  it('is able to apply refactors to external files', () => {
    waitsForPromise(async () => {
      const actions = await applyRefactoring({
        type: 'apply',
        payload: {
          response: {
            type: 'external-edit',
            edits: new Map([
              [
                testFile1,
                [
                  {
                    startOffset: 0,
                    endOffset: 3,
                    oldText: 'abc',
                    newText: 'aaa',
                  },
                  {
                    startOffset: 3,
                    endOffset: 6,
                    oldText: 'def',
                    newText: 'ddd',
                  },
                ],
              ],
              [
                testFile2,
                [
                  {
                    startOffset: 6,
                    endOffset: 9,
                    oldText: '789',
                    newText: '000',
                  },
                ],
              ],
            ]),
          },
        },
      })
        .toArray()
        .toPromise();

      const message = 'Applying edits...';
      expect(actions).toEqual([
        {type: 'progress', payload: {message, value: 0, max: 2}},
        {type: 'progress', payload: {message, value: 1, max: 2}},
        {type: 'progress', payload: {message, value: 2, max: 2}},
        {type: 'close'},
      ]);
      expect(fs.readFileSync(testFile1, 'utf8')).toBe('aaadddghi');
      expect(fs.readFileSync(testFile2, 'utf8')).toBe('123456000');
    });
  });

  it('errors on mismatch', () => {
    waitsForPromise(async () => {
      const actions = await applyRefactoring({
        type: 'apply',
        payload: {
          response: {
            type: 'external-edit',
            edits: new Map([
              [
                testFile1,
                [
                  {
                    startOffset: 0,
                    endOffset: 3,
                    oldText: 'abb',
                    newText: 'aaa',
                  },
                ],
              ],
            ]),
          },
        },
      })
        .toPromise()
        .catch(err => err);

      expect(actions instanceof Error).toBe(true);
    });
  });
});
