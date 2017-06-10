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

/* eslint-disable max-len, indent */

import prettyPrintTypes from '../lib/prettyPrintTypes';

function test(a, b) {
  expect(prettyPrintTypes(a)).toBe(b);
}

describe('prettyPrintTypes', () => {
  it('works', () => {
    // Parsing error
    test('{a', '{a');

    test(
      '(editor: atom$TextEditor, position: {column: number, row: number}, wordRegex_: ?RegExp) => ?{range: atom$Range, wordMatch: Array<string>}',
      `(
  editor: atom$TextEditor,
  position: {column: number, row: number},
  wordRegex_: ?RegExp
) => ?{
  range: atom$Range,
  wordMatch: Array<string>
}`,
    );

    test(
      "(file: ?string, currentContents: string) => Promise<?Array<{children: Array<any>, endPosition: {column: number, line: number}, representativeName?: string, startPosition: {column: number, line: number}, tokenizedText: Array<{kind: 'class-name' | 'constructor' | 'keyword' | 'method' | 'param' | 'plain' | 'string' | 'type' | 'whitespace', value: string}>}>>",
      `(
  file: ?string,
  currentContents: string
) => Promise<?Array<{
  children: Array<any>,
  endPosition: {column: number, line: number},
  representativeName?: string,
  startPosition: {column: number, line: number},
  tokenizedText: Array<{
    kind: 'class-name' | 'constructor' | 'keyword' | 'method' | 'param' | 'plain' | 'string' | 'type' | 'whitespace',
    value: string
  }>
}>>`,
    );

    test(
      '(file: string) => Promise<?{percentage: number, uncoveredRanges: Array<{end: {column: number, line: number}, start: {column: number, line: number}}>}>',
      `(file: string) => Promise<?{
  percentage: number,
  uncoveredRanges: Array<{
    end: {column: number, line: number},
    start: {column: number, line: number}
  }>
}>`,
    );

    test(
      '(providers: Array<{datatip: (editor: atom$TextEditor, bufferPosition: atom$Point) => Promise<?{component: ReactClass<any>, pinnable?: boolean, range: atom$Range}>, inclusionPriority: number, providerName: string, validForScope: (scopeName: string) => boolean}>, scopeName: string) => Array<{datatip: (editor: atom$TextEditor, bufferPosition: atom$Point) => Promise<?{component: ReactClass<any>, pinnable?: boolean, range: atom$Range}>, inclusionPriority: number, providerName: string, validForScope: (scopeName: string) => boolean}>',
      `(
  providers: Array<{
    datatip: (
      editor: atom$TextEditor,
      bufferPosition: atom$Point
    ) => Promise<?{
      component: ReactClass<any>,
      pinnable?: boolean,
      range: atom$Range
    }>,
    inclusionPriority: number,
    providerName: string,
    validForScope: (scopeName: string) => boolean
  }>,
  scopeName: string
) => Array<{
  datatip: (
    editor: atom$TextEditor,
    bufferPosition: atom$Point
  ) => Promise<?{
    component: ReactClass<any>,
    pinnable?: boolean,
    range: atom$Range
  }>,
  inclusionPriority: number,
  providerName: string,
  validForScope: (scopeName: string) => boolean
}>`,
    );

    test(
      '<T>(array: Array<?T>) => Array<T>',
      '<T>(array: Array<?T>) => Array<T>',
    );

    test(
      '?{errorCode?: string, errorMessage?: string, exitCode?: number, stderr: string, stdout: string}',
      `?{
  errorCode?: string,
  errorMessage?: string,
  exitCode?: number,
  stderr: string,
  stdout: string
}`,
    );

    test(
      '?{range: atom$Range, wordMatch: Array<string>}',
      `?{
  range: atom$Range,
  wordMatch: Array<string>
}`,
    );

    test(
      'Array<{datatip: (editor: atom$TextEditor, bufferPosition: atom$Point) => Promise<?{component: ReactClass<any>, pinnable?: boolean, range: atom$Range}>, inclusionPriority: number, providerName: string, validForScope: (scopeName: string) => boolean}>',
      `Array<{
  datatip: (
    editor: atom$TextEditor,
    bufferPosition: atom$Point
  ) => Promise<?{
    component: ReactClass<any>,
    pinnable?: boolean,
    range: atom$Range
  }>,
  inclusionPriority: number,
  providerName: string,
  validForScope: (scopeName: string) => boolean
}>`,
    );

    test(
      'a(100000, 200000, 300000, 400000, 500000, 600000)',
      `a(
  100000,
  200000,
  300000,
  400000,
  500000,
  600000
)`,
    );

    test(
      '{percentage: number, uncoveredRanges: Array<{end: {column: number, line: number}, start: {column: number, line: number}}>}',
      `{
  percentage: number,
  uncoveredRanges: Array<{
    end: {column: number, line: number},
    start: {column: number, line: number}
  }>
}`,
    );

    test(
      '{providerName: string, rangeEndColumn: string, rangeEndRow: string, rangeStartColumn: string, rangeStartRow: string, scope: string}',
      `{
  providerName: string,
  rangeEndColumn: string,
  rangeEndRow: string,
  rangeStartColumn: string,
  rangeStartRow: string,
  scope: string
}`,
    );

    test('Map<string, string>', 'Map<string, string>');
  });
});
