'use babel';
/* @flow */
/* global describe, it, expect */
/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 */

var {Range} = require('atom');

describe('FlowLinter::processDiagnostics', () => {

  var FlowLinter = require('../lib/FlowLinter');

  it('should propertly transform a simple diagnostic', () => {
    var diags = [
      {
        message: [
          {
            level: 'error',
            path: 'myPath',
            descr: 'message',
            line: 1,
            endline: 2,
            start: 3,
            end: 4,
            code: 0,
          },
        ],
      },
    ];

    var expectedOutput = {
      text: 'message',
      type: 'error',
      filePath: 'myPath',
      range: new Range([0, 2], [1, 4]),
    };

    var message = FlowLinter.processDiagnostics(diags, 'myPath')[0];
    expect(message).toEqual(expectedOutput);
  });

  it('should keep warnings as warnings', () => {
    var diags = [
      {
        message: [
          {
            level: 'warning',
            path: 'myPath',
            descr: 'message',
            line: 1,
            endline: 2,
            start: 3,
            end: 4,
            code: 0,
          },
        ],
      },
    ];

    var expectedOutput = {
      text: 'message',
      type: 'warning',
      filePath: 'myPath',
      range: new Range([0, 2], [1, 4]),
    };

    var message = FlowLinter.processDiagnostics(diags, 'myPath')[0];
    expect(message).toEqual(expectedOutput);
  });

  it('should filter diagnostics not in the target file', () => {
    var diags = [
      {
        message: [
          {
            path: 'notMyPath',
            descr: 'message',
            line: 1,
            endline: 2,
            start: 3,
            end: 4,
            code: 0,
          },
        ],
      },
    ];

    var message = FlowLinter.processDiagnostics(diags, 'myPath')[0];
    expect(message).toBeUndefined();
  });

  it('should create traces for diagnostics spanning multiple messages and combine the error text', () => {
    var diags = [
      {
        message: [
          {
            level: 'error',
            path: 'myPath',
            descr: 'message',
            line: 1,
            endline: 2,
            start: 3,
            end: 4,
            code: 0,
          },
          {
            level: 'error',
            path: 'otherPath',
            descr: 'more message',
            line: 5,
            endline: 6,
            start: 7,
            end: 8,
            code: 0,
          },
        ],
      },
    ];

    var expectedOutput = {
      type: 'error',
      text: 'message more message',
      filePath: 'myPath',
      range: new Range([0, 2], [1, 4]),
      trace: [{
        type: 'Trace',
        filePath: 'otherPath',
        text: 'more message',
        range: new Range([4, 6], [5, 8]),
      }],
    };

    var message = FlowLinter.processDiagnostics(diags, 'myPath')[0];
    expect(message).toEqual(expectedOutput);
  });

});
