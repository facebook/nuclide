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

import {convertReferences} from '../lib/FindReferences';
import {addMatchers} from '../../nuclide-test-helpers';

const projectRoot = '/test/';
const file1Path = '/test/file1.php';
const file2Path = '/test/file2.php';

describe('FindReferences', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  it('convertReferences', () => {
    expect(
      convertReferences(
        [
          {
            name: '\\TestClass::testFunction',
            filename: file1Path,
            line: 13,
            char_start: 5,
            char_end: 7,
          },
          {
            name: '\\TestClass::testFunction',
            filename: file2Path,
            line: 11,
            char_start: 1,
            char_end: 3,
          },
        ],
        projectRoot,
      ),
    ).diffJson({
      type: 'data',
      baseUri: '/test/',
      referencedSymbolName: 'TestClass::testFunction',
      references: [
        {
          uri: '/test/file1.php',
          name: null,
          range: {
            start: {row: 12, column: 4},
            end: {row: 12, column: 7},
          },
        },
        {
          uri: '/test/file2.php',
          name: null,
          range: {
            start: {row: 10, column: 0},
            end: {row: 10, column: 3},
          },
        },
      ],
    });
  });
});
