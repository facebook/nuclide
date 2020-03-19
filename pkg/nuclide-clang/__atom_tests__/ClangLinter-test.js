/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import {Point, Range} from 'atom';
import ClangLinter from '../lib/ClangLinter';
import * as range from 'nuclide-commons-atom/range';

describe('ClangDiagnosticsProvider', () => {
  const TEST_PATH = '/path/test.cpp';
  const TEST_PATH2 = '/path/asdf';

  const fakeEditor: any = {
    getBuffer: () => ({
      isDestroyed: () => false,
      getPath: () => TEST_PATH,
      rangeForRow: row => new Range([row, 0], [row + 1, 0]),
    }),
  };

  beforeEach(() => {
    jest
      .spyOn(range, 'wordAtPosition')
      .mockImplementation((editor, pos, regex) => {
        return {
          range: new Range(pos, [pos.row, pos.column + 1]),
        };
      });
  });

  describe('processDiagnostics', () => {
    it('should group diagnostics by file', () => {
      const messages = ClangLinter._processDiagnostics(
        {
          diagnostics: [
            {
              severity: 2,
              location: {
                file: '',
                point: new Point(-1, -1),
              },
              ranges: null,
              spelling: 'whole file',
            },
            {
              severity: 1, // severity < 2 is ignored
              location: {
                file: '',
                point: new Point(0, 0),
              },
              ranges: [],
              spelling: 'ignore me',
            },
            {
              severity: 2,
              location: {
                file: TEST_PATH2,
                point: new Point(0, 0),
              },
              ranges: null, // use the entire line
              spelling: 'other file',
              fixits: [
                {
                  range: {
                    file: TEST_PATH2,
                    // Do not touch fixit ranges.
                    range: new Range([3, 4], [3, 4]),
                  },
                  value: 'fixit',
                },
              ],
              children: [
                {
                  spelling: 'child error',
                  location: {
                    file: TEST_PATH2,
                    point: new Point(0, 0),
                  },
                  ranges: [],
                },
              ],
            },
            {
              severity: 2,
              location: {
                file: TEST_PATH,
                point: new Point(0, 0),
              },
              // Invalid ranges should use the point as fallback.
              ranges: [
                {
                  file: null,
                  range: new Range([-1, -1], [-1, -1]),
                },
              ],
              spelling: 'test error',
            },
            {
              severity: 3,
              location: {
                file: TEST_PATH,
                point: new Point(0, 0),
              },
              ranges: [
                {
                  file: TEST_PATH,
                  range: new Range([1, 0], [1, 2]),
                },
              ],
              spelling: 'test error 2',
            },
          ],
          accurateFlags: true,
        },
        fakeEditor,
      );

      expect(messages).toEqual([
        {
          type: 'Warning',
          filePath: TEST_PATH,
          text: 'whole file',
          range: new Range([0, 0], [1, 0]),
          fix: undefined,
          trace: undefined,
        },
        {
          type: 'Warning',
          filePath: TEST_PATH2,
          text: 'other file',
          range: new Range([0, 0], [0, 1]),
          trace: [
            {
              type: 'Trace',
              text: 'child error',
              filePath: TEST_PATH2,
              range: new Range([0, 0], [0, 1]),
            },
          ],
          fix: {
            range: new Range([3, 4], [3, 4]),
            newText: 'fixit',
          },
        },
        {
          type: 'Warning',
          filePath: TEST_PATH,
          text: 'test error',
          range: new Range([0, 0], [0, 1]),
          fix: undefined,
          trace: undefined,
        },
        {
          type: 'Error',
          filePath: TEST_PATH,
          text: 'test error 2',
          range: new Range([1, 0], [1, 2]),
          fix: undefined,
          trace: undefined,
        },
      ]);
    });
  });
});
