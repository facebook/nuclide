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

import type {FileDiagnosticMessage} from 'atom-ide-ui';

import {Range} from 'simple-text-buffer';

import {
  flowStatusOutputToDiagnostics,
  diagnosticToFix,
} from '../lib/diagnosticsParser';
import {addMatchers} from '../../nuclide-test-helpers';

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
  ],
};

const expected: Array<FileDiagnosticMessage> = [
  {
    type: 'Error',
    scope: 'file',
    providerName: 'Flow',
    filePath: '/flow-test/src/test.js',
    text: 'object literal',
    range: new Range([12, 15], [12, 17]),
    trace: [
      {
        type: 'Trace',
        text: 'This type is incompatible with',
      },
      {
        type: 'Trace',
        text: 'union: object type(s)',
        filePath: '/flow-test/src/test.js',
        range: new Range([9, 7], [9, 10]),
      },
      {
        type: 'Trace',
        text: 'See also: assignment of property `bar`',
        filePath: '/flow-test/src/test.js',
        range: new Range([12, 4], [12, 12]),
      },
    ],
  },
  {
    type: 'Warning',
    scope: 'file',
    providerName: 'Flow',
    filePath: 'myPath',
    text: 'message',
    range: new Range([0, 2], [1, 4]),
  },
  {
    type: 'Error',
    scope: 'file',
    providerName: 'Flow',
    filePath: '/flow-test/src/test.js',
    text: 'object type',
    range: new Range([82, 8], [82, 12]),
    trace: [
      {
        type: 'Trace',
        text: 'This type is incompatible with an argument type of',
      },
      {
        type: 'Trace',
        text: 'global object',
      },
    ],
  },
];

describe('flowStatusOutputToDiagnostics', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  it('converts the flow status output', () => {
    expect(flowStatusOutputToDiagnostics(flowOutput)).diffJson(expected);
  });
});

describe('diagnosticToFix', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  it('should provide a fix for an unused suppression comment', () => {
    const diagnostic: FileDiagnosticMessage = {
      filePath: 'foo',
      providerName: 'Flow',
      scope: 'file',
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
    expect(fix).diffJson({
      oldRange: new Range([5, 0], [5, 13]),
      newText: '',
      speculative: true,
    });
  });

  it('should provide a fix for named import typos', () => {
    const diagnostic: FileDiagnosticMessage = {
      type: 'Error',
      scope: 'file',
      providerName: 'Flow',
      filePath: 'foo',
      range: new Range([2, 8], [2, 16]),
      text: 'Named import from module `./foo`',
      trace: [
        {
          type: 'Trace',
          text: 'This module has no named export called `FooBrBaaaaz`. Did you mean `foobar`?',
          rangeInFile: null,
        },
      ],
    };
    const fix = diagnosticToFix(diagnostic);
    expect(fix).diffJson({
      oldRange: new Range([2, 8], [2, 16]),
      oldText: 'FooBrBaaaaz',
      newText: 'foobar',
      speculative: true,
    });
  });
});
