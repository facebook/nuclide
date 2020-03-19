/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Range, Point} from 'atom';
import {generateFixture} from 'nuclide-commons/test-helpers';
import {applyRefactoring} from '../lib/refactorEpics';
import path from 'path';

describe('applyRefactoring', () => {
  let testDir;
  let testFile1;
  let testFile2;
  beforeEach(async () => {
    const fixturesPath = path.resolve(__dirname, '../__mocks__/fixtures');
    atom.project.setPaths([fixturesPath]);
    testDir = await generateFixture(
      'refactoring',
      new Map([['test1.txt', 'abcdefghi'], ['test2.txt', '123456789']]),
    );
    testFile1 = nuclideUri.join(testDir, 'test1.txt');
    testFile2 = nuclideUri.join(testDir, 'test2.txt');
  });

  it('is able to apply refactors to external files', async () => {
    const actions = await applyRefactoring({
      type: 'apply',
      payload: {
        response: {
          type: 'rename-external-edit',
          edits: new Map([
            [
              testFile1,
              [
                {
                  oldRange: new Range(new Point(0, 0), new Point(0, 3)),
                  newText: 'aaa',
                },
                {
                  oldRange: new Range(new Point(0, 3), new Point(0, 6)),
                  newText: 'ddd',
                },
              ],
            ],
            [
              testFile2,
              [
                {
                  oldRange: new Range(new Point(0, 6), new Point(0, 9)),
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

  // NOTE: `oldText` isn't used in LSP method `textDocument/rename`.
  //        So the Refactorizer isn't actually able to raise errors for this
  //        when it's being used.
  it('errors on mismatch', async () => {
    const actions = await applyRefactoring({
      type: 'apply',
      payload: {
        response: {
          type: 'rename-external-edit',
          edits: new Map([
            [
              testFile1,
              [
                {
                  oldRange: new Range(new Point(0, 0), new Point(0, 3)),
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
