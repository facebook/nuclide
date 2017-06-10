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
import {Point, Range} from 'atom';
import fs from 'fs';

import nuclideUri from 'nuclide-commons/nuclideUri';
import Refactoring from '../lib/Refactoring';
import {getDiagnostics} from '../lib/libclang';

const TEST_PATH = nuclideUri.join(__dirname, 'fixtures', 'references.cpp');

const fakeEditor: any = {
  getPath: () => TEST_PATH,
  getText: () => fs.readFileSync(TEST_PATH, 'utf8'),
};

describe('Refactoring', () => {
  beforeEach(() => {
    waitsForPromise(async () => {
      // Ensure that the file is compiled.
      await getDiagnostics(fakeEditor);
    });
  });

  describe('Refactoring.refactoringsAtPoint', () => {
    it('returns refactorings for a variable', () => {
      waitsForPromise({timeout: 15000}, async () => {
        const refactorings = await Refactoring.refactoringsAtPoint(
          fakeEditor,
          new Point(2, 6),
        );
        expect(refactorings).toEqual([
          {
            kind: 'rename',
            symbolAtPoint: {
              text: 'var2',
              range: new Range([2, 2], [2, 17]),
            },
          },
        ]);
      });
    });

    it('returns nothing for a function', () => {
      waitsForPromise({timeout: 15000}, async () => {
        const refactorings = await Refactoring.refactoringsAtPoint(
          fakeEditor,
          new Point(1, 5),
        );
        expect(refactorings).toEqual([]);
      });
    });
  });

  describe('Refactoring.refactor', () => {
    it('refactors a parameter', () => {
      waitsForPromise({timeout: 15000}, async () => {
        const response = await Refactoring.refactor({
          editor: fakeEditor,
          kind: 'rename',
          newName: 'new_var',
          symbolAtPoint: {
            range: new Range([1, 21], [1, 28]),
            text: 'var1',
          },
          originalPoint: new Point(1, 25),
        }).toPromise();
        invariant(response.type === 'edit', 'Must be a standard edit');
        expect(Array.from(response.edits)).toEqual([
          [
            TEST_PATH,
            [
              {
                // param declaration
                oldRange: new Range([1, 25], [1, 29]),
                oldText: 'var1',
                newText: 'new_var',
              },
              {
                // int var2 = var1
                oldRange: new Range([2, 13], [2, 17]),
                oldText: 'var1',
                newText: 'new_var',
              },
            ],
          ],
        ]);
      });
    });
  });
});
