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

import {outlineFromHackIdeOutline} from '../lib/OutlineView';
import {addMatchers} from '../../nuclide-test-helpers';

describe('outlineFromHackIdeOutline', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  it('function', () => {
    const actualOutline = outlineFromHackIdeOutline([
      {
        name: 'f',
        representativeName: 'f',
        modifiers: [],
        span: {
          line_start: 3,
          line_end: 4,
          char_start: 1,
          char_end: 1,
          filename: '',
        },
        kind: 'function',
        params: [
          {
            kind: 'param',
            position: {
              filename: '',
              char_end: 17,
              char_start: 16,
              line: 3,
            },
            modifiers: [],
            span: {
              line_start: 3,
              line_end: 3,
              char_start: 12,
              char_end: 17,
              filename: '',
            },
            name: '$x',
          },
          {
            kind: 'param',
            position: {
              filename: '',
              char_end: 21,
              char_start: 20,
              line: 3,
            },
            modifiers: [],
            span: {
              line_start: 3,
              line_end: 3,
              char_start: 20,
              char_end: 21,
              filename: '',
            },
            name: '$y',
          },
        ],
        position: {
          filename: '',
          char_end: 10,
          line: 3,
          char_start: 10,
        },
      },
    ]);
    expect(actualOutline).diffJson({
      outlineTrees: [
        {
          tokenizedText: [
            {
              kind: 'keyword',
              value: 'function',
            },
            {
              kind: 'whitespace',
              value: ' ',
            },
            {
              kind: 'method',
              value: 'f',
            },
            {
              kind: 'plain',
              value: '(',
            },
            {
              kind: 'plain',
              value: '$x',
            },
            {
              kind: 'plain',
              value: ',',
            },
            {
              kind: 'whitespace',
              value: ' ',
            },
            {
              kind: 'plain',
              value: '$y',
            },
            {
              kind: 'plain',
              value: ')',
            },
          ],
          representativeName: 'f',
          startPosition: {
            row: 2,
            column: 9,
          },
          endPosition: {
            row: 3,
            column: 0,
          },
          children: [],
        },
      ],
    });
  });

  it('class', () => {
    const actualOutline = outlineFromHackIdeOutline([
      {
        name: 'D',
        children: [
          {
            position: {
              filename: '',
              char_end: 14,
              char_start: 14,
              line: 11,
            },
            kind: 'typeconst',
            name: 'Y',
            modifiers: [],
            span: {
              char_end: 20,
              filename: '',
              line_end: 11,
              char_start: 3,
              line_start: 11,
            },
          },
          {
            kind: 'property',
            position: {
              char_start: 39,
              line: 12,
              char_end: 40,
              filename: '',
            },
            modifiers: ['private'],
            span: {
              line_end: 12,
              char_start: 39,
              char_end: 40,
              filename: '',
              line_start: 12,
            },
            name: 'x',
          },
          {
            name: '__construct',
            modifiers: ['public'],
            span: {
              char_end: 3,
              filename: '',
              line_end: 14,
              char_start: 3,
              line_start: 12,
            },
            position: {
              char_start: 19,
              line: 12,
              filename: '',
              char_end: 29,
            },
            kind: 'method',
            params: [
              {
                position: {
                  filename: '',
                  char_end: 40,
                  char_start: 39,
                  line: 12,
                },
                kind: 'param',
                name: '$x',
                modifiers: ['private'],
                span: {
                  line_start: 12,
                  char_start: 39,
                  line_end: 12,
                  filename: '',
                  char_end: 40,
                },
              },
            ],
          },
          {
            modifiers: ['abstract'],
            span: {
              line_start: 15,
              char_end: 18,
              filename: '',
              line_end: 15,
              char_start: 18,
            },
            name: 'Z',
            kind: 'const',
            position: {
              filename: '',
              char_end: 18,
              line: 15,
              char_start: 18,
            },
          },
          {
            kind: 'const',
            position: {
              char_end: 9,
              filename: '',
              char_start: 9,
              line: 16,
            },
            name: 'X',
            modifiers: [],
            span: {
              char_start: 9,
              line_end: 16,
              filename: '',
              char_end: 14,
              line_start: 16,
            },
          },
        ],
        span: {
          filename: '',
          char_end: 1,
          char_start: 1,
          line_end: 17,
          line_start: 10,
        },
        modifiers: ['abstract'],
        kind: 'class',
        position: {
          char_start: 16,
          line: 10,
          filename: '',
          char_end: 16,
        },
      },
    ]);
    expect(actualOutline).diffJson({
      outlineTrees: [
        {
          tokenizedText: [
            {kind: 'keyword', value: 'abstract'},
            {kind: 'whitespace', value: ' '},
            {kind: 'keyword', value: 'class'},
            {kind: 'whitespace', value: ' '},
            {kind: 'class-name', value: 'D'},
          ],
          representativeName: 'D',
          startPosition: {row: 9, column: 15},
          endPosition: {row: 16, column: 0},
          children: [
            {
              tokenizedText: [
                {kind: 'keyword', value: 'const'},
                {kind: 'whitespace', value: ' '},
                {kind: 'keyword', value: 'type'},
                {kind: 'whitespace', value: ' '},
                {kind: 'class-name', value: 'Y'},
              ],
              representativeName: 'Y',
              startPosition: {row: 10, column: 13},
              endPosition: {row: 10, column: 19},
              children: [],
            },
            {
              tokenizedText: [
                {kind: 'keyword', value: 'private'},
                {kind: 'whitespace', value: ' '},
                {kind: 'keyword', value: 'property'},
                {kind: 'whitespace', value: ' '},
                {kind: 'method', value: 'x'},
              ],
              representativeName: 'x',
              startPosition: {row: 11, column: 38},
              endPosition: {row: 11, column: 39},
              children: [],
            },
            {
              tokenizedText: [
                {kind: 'keyword', value: 'public'},
                {kind: 'whitespace', value: ' '},
                {kind: 'keyword', value: 'function'},
                {kind: 'whitespace', value: ' '},
                {kind: 'method', value: '__construct'},
                {kind: 'plain', value: '('},
                {kind: 'keyword', value: 'private'},
                {kind: 'whitespace', value: ' '},
                {kind: 'plain', value: '$x'},
                {kind: 'plain', value: ')'},
              ],
              representativeName: '__construct',
              startPosition: {row: 11, column: 18},
              endPosition: {row: 13, column: 2},
              children: [],
            },
            {
              tokenizedText: [
                {kind: 'keyword', value: 'abstract'},
                {kind: 'whitespace', value: ' '},
                {kind: 'keyword', value: 'const'},
                {kind: 'whitespace', value: ' '},
                {kind: 'method', value: 'Z'},
              ],
              representativeName: 'Z',
              startPosition: {row: 14, column: 17},
              endPosition: {row: 14, column: 17},
              children: [],
            },
            {
              tokenizedText: [
                {kind: 'keyword', value: 'const'},
                {kind: 'whitespace', value: ' '},
                {kind: 'method', value: 'X'},
              ],
              representativeName: 'X',
              startPosition: {row: 15, column: 8},
              endPosition: {row: 15, column: 13},
              children: [],
            },
          ],
        },
      ],
    });
  });

  it('trait', () => {
    const actualOutline = outlineFromHackIdeOutline([
      {
        position: {
          filename: '',
          char_end: 7,
          char_start: 7,
          line: 19,
        },
        kind: 'trait',
        children: [
          {
            name: 'f',
            span: {
              char_start: 3,
              line_end: 22,
              filename: '',
              char_end: 3,
              line_start: 20,
            },
            modifiers: ['public'],
            position: {
              char_start: 19,
              line: 20,
              filename: '',
              char_end: 19,
            },
            kind: 'method',
            params: [],
          },
        ],
        name: 'T',
        modifiers: [],
        span: {
          char_start: 1,
          line_end: 23,
          filename: '',
          char_end: 1,
          line_start: 19,
        },
      },
    ]);
    expect(actualOutline).diffJson({
      outlineTrees: [
        {
          tokenizedText: [
            {
              kind: 'keyword',
              value: 'trait',
            },
            {
              kind: 'whitespace',
              value: ' ',
            },
            {
              kind: 'method',
              value: 'T',
            },
          ],
          representativeName: 'T',
          startPosition: {
            row: 18,
            column: 6,
          },
          endPosition: {
            row: 22,
            column: 0,
          },
          children: [
            {
              tokenizedText: [
                {
                  kind: 'keyword',
                  value: 'public',
                },
                {
                  kind: 'whitespace',
                  value: ' ',
                },
                {
                  kind: 'keyword',
                  value: 'function',
                },
                {
                  kind: 'whitespace',
                  value: ' ',
                },
                {
                  kind: 'method',
                  value: 'f',
                },
                {
                  kind: 'plain',
                  value: '(',
                },
                {
                  kind: 'plain',
                  value: ')',
                },
              ],
              representativeName: 'f',
              startPosition: {
                row: 19,
                column: 18,
              },
              endPosition: {
                row: 21,
                column: 2,
              },
              children: [],
            },
          ],
        },
      ],
    });
  });

  it('interface', () => {
    const actualOutline = outlineFromHackIdeOutline([
      {
        kind: 'interface',
        position: {
          line: 25,
          char_start: 11,
          filename: '',
          char_end: 11,
        },
        span: {
          filename: '',
          char_end: 14,
          char_start: 1,
          line_end: 25,
          line_start: 25,
        },
        modifiers: [],
        name: 'I',
        children: [],
      },
    ]);
    expect(actualOutline).diffJson({
      outlineTrees: [
        {
          tokenizedText: [
            {
              kind: 'keyword',
              value: 'interface',
            },
            {
              kind: 'whitespace',
              value: ' ',
            },
            {
              kind: 'method',
              value: 'I',
            },
          ],
          representativeName: 'I',
          startPosition: {
            row: 24,
            column: 10,
          },
          endPosition: {
            row: 24,
            column: 13,
          },
          children: [],
        },
      ],
    });
  });

  it('enum', () => {
    const actualOutline = outlineFromHackIdeOutline([
      {
        name: 'En',
        children: [
          {
            kind: 'const',
            position: {
              line: 28,
              char_start: 3,
              filename: '',
              char_end: 3,
            },
            span: {
              filename: '',
              char_end: 7,
              char_start: 3,
              line_end: 28,
              line_start: 28,
            },
            modifiers: [],
            name: 'C',
          },
        ],
        span: {
          line_start: 27,
          line_end: 29,
          char_start: 1,
          char_end: 1,
          filename: '',
        },
        modifiers: [],
        position: {
          char_end: 7,
          filename: '',
          char_start: 6,
          line: 27,
        },
        kind: 'enum',
      },
    ]);
    expect(actualOutline).diffJson({
      outlineTrees: [
        {
          tokenizedText: [
            {
              kind: 'keyword',
              value: 'enum',
            },
            {
              kind: 'whitespace',
              value: ' ',
            },
            {
              kind: 'class-name',
              value: 'En',
            },
          ],
          representativeName: 'En',
          startPosition: {
            row: 26,
            column: 5,
          },
          endPosition: {
            row: 28,
            column: 0,
          },
          children: [
            {
              tokenizedText: [
                {
                  kind: 'keyword',
                  value: 'const',
                },
                {
                  kind: 'whitespace',
                  value: ' ',
                },
                {
                  kind: 'method',
                  value: 'C',
                },
              ],
              representativeName: 'C',
              startPosition: {
                row: 27,
                column: 2,
              },
              endPosition: {
                row: 27,
                column: 6,
              },
              children: [],
            },
          ],
        },
      ],
    });
  });
});
