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
import type {FileDiagnosticMessage} from '../../nuclide-language-service/lib/LanguageService';

import {Range} from 'simple-text-buffer';

import {
  flowStatusOutputToDiagnostics,
  diagnosticToFix,
} from '../lib/diagnosticsParser';

import flowChildrenOutput from '../__mocks__/fixtures/flow-children-output.json';

const flowOutput = {
  passed: false,
  flowVersion: '0.23.0',
  errors: [
    {
      operation: {
        descr: 'assignment of property `bar`',
        loc: {
          start: {
            offset: 104,
            line: 13,
            column: 5,
          },
          source: '/flow-test/src/test.js',
          end: {
            offset: 112,
            line: 13,
            column: 12,
          },
        },
      },
      message: [
        {
          descr: 'object literal',
          loc: {
            start: {
              offset: 115,
              line: 13,
              column: 16,
            },
            source: '/flow-test/src/test.js',
            end: {
              line: 13,
              offset: 117,
              column: 17,
            },
          },
        },
        {
          descr: 'This type is incompatible with',
          path: '',
        },
        {
          descr: 'union: object type(s)',
          loc: {
            end: {
              line: 10,
              offset: 87,
              column: 10,
            },
            source: '/flow-test/src/test.js',
            start: {
              column: 8,
              line: 10,
              offset: 84,
            },
          },
        },
      ],
      kind: 'infer',
      level: 'error',
    },
    {
      kind: 'infer',
      level: 'warning',
      message: [
        {
          descr: 'message',
          loc: {
            source: 'myPath',
            start: {
              line: 1,
              column: 3,
            },
            end: {
              line: 2,
              column: 4,
            },
          },
        },
      ],
    },
    {
      kind: 'infer',
      level: 'error',
      message: [
        {
          context: '        next.onLoad(results, count);',
          descr: 'object type',
          type: 'Blame',
          loc: {
            source: '/flow-test/src/test.js',
            type: 'SourceFile',
            start: {line: 83, column: 9, offset: 1992},
            end: {line: 83, column: 12, offset: 1996},
          },
          path: '/flow-test/src/test.js',
          line: 83,
          endline: 83,
          start: 9,
          end: 12,
        },
        {
          context: null,
          descr: 'This type is incompatible with an argument type of',
          type: 'Comment',
          path: '',
          line: 0,
          endline: 0,
          start: 1,
          end: 0,
        },
        {
          context: null,
          descr: 'global object',
          type: 'Blame',
          loc: {
            source: '(builtins)',
            type: 'Builtins',
            start: {line: 0, column: 1, offset: 0},
            end: {line: 0, column: 0, offset: 0},
          },
          path: '(builtins)',
          line: 0,
          endline: 0,
          start: 1,
          end: 0,
        },
      ],
    },
    flowChildrenOutput,
  ],
};

describe('flowStatusOutputToDiagnostics', () => {
  it('converts the flow status output', () => {
    expect(flowStatusOutputToDiagnostics(flowOutput)).toMatchSnapshot();
  });

  it('converts the flow status output >=0.66.0', () => {
    expect(
      flowStatusOutputToDiagnostics({
        flowVersion: '0.65.0',
        errors: [
          {
            kind: 'infer',
            level: 'error',
            classic: false,
            primaryLoc: {
              source: 'test.js',
              type: 'SourceFile',
              start: {line: 9, column: 3, offset: 92},
              end: {line: 9, column: 4, offset: 94},
            },
            rootLoc: {
              source: 'test.js',
              type: 'SourceFile',
              start: {line: 9, column: 2, offset: 91},
              end: {line: 9, column: 5, offset: 95},
            },
            messageMarkup: [
              {
                kind: 'Text',
                text: 'Cannot cast array literal to tuple type because ',
              },
              {
                kind: 'Reference',
                referenceId: '1',
                message: [{kind: 'Text', text: 'number'}],
              },
              {kind: 'Text', text: ' is incompatible with '},
              {
                kind: 'Reference',
                referenceId: '2',
                message: [{kind: 'Text', text: 'empty'}],
              },
              {kind: 'Text', text: ' in property '},
              {kind: 'Code', text: 'p'},
              {kind: 'Text', text: ' of index 0.'},
            ],
            referenceLocs: {
              '1': {
                source: 'test.js',
                type: 'SourceFile',
                start: {line: 7, column: 16, offset: 65},
                end: {line: 7, column: 17, offset: 67},
              },
              '2': {
                source: 'test.js',
                type: 'SourceFile',
                start: {line: 6, column: 14, offset: 42},
                end: {line: 6, column: 18, offset: 47},
              },
            },
          },
          {
            kind: 'infer',
            level: 'error',
            classic: false,
            primaryLoc: {
              source: 'test.js',
              type: 'SourceFile',
              start: {line: 10, column: 2, offset: 104},
              end: {line: 10, column: 5, offset: 108},
            },
            rootLoc: {
              source: 'test.js',
              type: 'SourceFile',
              start: {line: 10, column: 2, offset: 104},
              end: {line: 10, column: 5, offset: 108},
            },
            messageMarkup: {
              kind: 'UnorderedList',
              message: [
                {
                  kind: 'Text',
                  text: 'Cannot cast array literal to union type because:',
                },
              ],
              items: [
                [
                  {kind: 'Text', text: 'Either '},
                  {
                    kind: 'Reference',
                    referenceId: '1',
                    message: [{kind: 'Text', text: 'number'}],
                  },
                  {kind: 'Text', text: ' is incompatible with '},
                  {
                    kind: 'Reference',
                    referenceId: '2',
                    message: [{kind: 'Text', text: 'empty'}],
                  },
                  {kind: 'Text', text: ' in property '},
                  {kind: 'Code', text: 'p'},
                  {kind: 'Text', text: ' of index 0.'},
                ],
                [
                  {kind: 'Text', text: 'Or '},
                  {
                    kind: 'Reference',
                    referenceId: '1',
                    message: [{kind: 'Text', text: 'number'}],
                  },
                  {kind: 'Text', text: ' is incompatible with '},
                  {
                    kind: 'Reference',
                    referenceId: '3',
                    message: [{kind: 'Text', text: 'empty'}],
                  },
                  {kind: 'Text', text: ' in property '},
                  {kind: 'Code', text: 'p'},
                  {kind: 'Text', text: ' of index 0.'},
                ],
                [
                  {kind: 'Text', text: 'Or '},
                  {
                    kind: 'Reference',
                    referenceId: '1',
                    message: [{kind: 'Text', text: 'number'}],
                  },
                  {kind: 'Text', text: ' is incompatible with '},
                  {
                    kind: 'Reference',
                    referenceId: '4',
                    message: [{kind: 'Text', text: 'empty'}],
                  },
                  {kind: 'Text', text: ' in property '},
                  {kind: 'Code', text: 'p'},
                  {kind: 'Text', text: ' of index 0.'},
                ],
                [
                  {kind: 'Text', text: 'Or '},
                  {
                    kind: 'Reference',
                    referenceId: '1',
                    message: [{kind: 'Text', text: 'number'}],
                  },
                  {kind: 'Text', text: ' is incompatible with '},
                  {
                    kind: 'Reference',
                    referenceId: '5',
                    message: [{kind: 'Text', text: 'empty'}],
                  },
                  {kind: 'Text', text: ' in property '},
                  {kind: 'Code', text: 'p'},
                  {kind: 'Text', text: ' of index 0.'},
                ],
              ],
            },
            referenceLocs: {
              '1': {
                source: 'test.js',
                type: 'SourceFile',
                start: {line: 8, column: 16, offset: 85},
                end: {line: 8, column: 17, offset: 87},
              },
              '2': {
                source: 'test.js',
                type: 'SourceFile',
                start: {line: 10, column: 13, offset: 115},
                end: {line: 10, column: 17, offset: 120},
              },
              '3': {
                source: 'test.js',
                type: 'SourceFile',
                start: {line: 10, column: 21, offset: 123},
                end: {line: 10, column: 25, offset: 128},
              },
              '4': {
                source: 'test.js',
                type: 'SourceFile',
                start: {line: 10, column: 36, offset: 138},
                end: {line: 10, column: 40, offset: 143},
              },
              '5': {
                source: 'test.js',
                type: 'SourceFile',
                start: {line: 10, column: 44, offset: 146},
                end: {line: 10, column: 48, offset: 151},
              },
            },
          },
        ],
        passed: false,
      }),
    ).toMatchSnapshot();
  });
});

describe('diagnosticToFix', () => {
  it('should provide a fix for an unused suppression comment', () => {
    const diagnostic: FileDiagnosticMessage = {
      filePath: 'foo',
      providerName: 'Flow',
      type: 'Error',
      text: 'Error suppressing comment',
      range: new Range([5, 0], [5, 13]),
      trace: [
        {
          type: 'Trace',
          text: 'Unused suppression',
        },
      ],
    };
    const fix = diagnosticToFix(diagnostic);
    expect(fix).toEqual({
      oldRange: new Range([5, 0], [5, 13]),
      newText: '',
      speculative: true,
    });
  });

  it('should provide a fix for named import typos', () => {
    const diagnostic: FileDiagnosticMessage = {
      type: 'Error',
      providerName: 'Flow',
      filePath: 'foo',
      range: new Range([2, 8], [2, 16]),
      text: 'Named import from module `./foo`',
      trace: [
        {
          type: 'Trace',
          text:
            'This module has no named export called `FooBrBaaaaz`. Did you mean `foobar`?',
          rangeInFile: null,
        },
      ],
    };
    const fix = diagnosticToFix(diagnostic);
    expect(fix).toEqual({
      oldRange: new Range([2, 8], [2, 16]),
      oldText: 'FooBrBaaaaz',
      newText: 'foobar',
      speculative: true,
    });
  });
});
