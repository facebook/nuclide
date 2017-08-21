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
 */

import type {FileDiagnosticMessage} from '../../atom-ide-diagnostics/lib/types';

import {Range} from 'atom';
import {compareMessagesByFile} from '../lib/paneUtils';

describe('compareMessagesByFile', () => {
  let fileAMsgA: FileDiagnosticMessage;
  let fileAMsgB: FileDiagnosticMessage;
  let fileAError: FileDiagnosticMessage;
  let fileAInfo: FileDiagnosticMessage;
  let fileBMsgA: FileDiagnosticMessage;

  beforeEach(() => {
    fileAMsgA = {
      filePath: '/foo/bar/baz.html',
      providerName: 'foo',
      range: new Range([0, 0], [1, 0]),
      scope: 'file',
      type: 'Warning',
    };
    fileAMsgB = {
      filePath: '/foo/bar/baz.html',
      providerName: 'foo',
      range: new Range([5, 0], [6, 0]),
      scope: 'file',
      type: 'Warning',
    };
    fileAError = {
      filePath: '/foo/bar/baz.html',
      providerName: 'foo',
      range: new Range([10, 0], [11, 0]),
      scope: 'file',
      type: 'Error',
    };
    fileAInfo = {
      filePath: '/foo/bar/baz.html',
      providerName: 'foo',
      range: new Range([0, 0], [0, 0]),
      scope: 'file',
      type: 'Info',
    };
    fileBMsgA = {
      filePath: '/foo/bar/xyz.html',
      providerName: 'foo',
      range: new Range([3, 0], [4, 0]),
      scope: 'file',
      type: 'Warning',
    };
  });

  it('sorts messages based on file path', () => {
    const msgs = [fileBMsgA, fileAMsgA];
    expect(msgs.sort(compareMessagesByFile)).toEqual([fileAMsgA, fileBMsgA]);
  });

  it('sorts messages within a file based on line number', () => {
    const msgs = [fileAMsgB, fileAMsgA];
    expect(msgs.sort(compareMessagesByFile)).toEqual([fileAMsgA, fileAMsgB]);
  });

  it('sorts messages based on file path && by line number', () => {
    const msgs = [fileAMsgB, fileBMsgA, fileAMsgA];
    expect(msgs.sort(compareMessagesByFile)).toEqual([
      fileAMsgA,
      fileAMsgB,
      fileBMsgA,
    ]);
  });

  it('sorts messages based on level', () => {
    const msgs = [fileAMsgA, fileAMsgB, fileAError, fileAInfo];
    expect(msgs.sort(compareMessagesByFile)).toEqual([
      fileAError,
      fileAMsgA,
      fileAMsgB,
      fileAInfo,
    ]);
  });
});
