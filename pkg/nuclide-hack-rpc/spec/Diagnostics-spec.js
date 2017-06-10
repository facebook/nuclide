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

import {hackMessageToDiagnosticMessage} from '../lib/Diagnostics';
import {Range} from 'simple-text-buffer';

const testPath = 'myPath';

describe('Diagnostics', () => {
  describe('hackMessageToDiagnosticMessage', () => {
    it('should propertly transform a simple diagnostic', () => {
      const hackMessage = [
        {
          path: testPath,
          descr: 'message',
          line: 1,
          start: 3,
          end: 4,
          code: 1234,
        },
      ];

      const expectedOutput = {
        scope: 'file',
        providerName: 'Hack: 1234',
        text: 'message',
        type: 'Error',
        filePath: testPath,
        range: new Range([0, 2], [0, 4]),
      };

      const output = hackMessageToDiagnosticMessage(hackMessage);
      expect(output).toEqual(expectedOutput);
    });

    it('should create traces for diagnostics on multiple messages and combine the text', () => {
      const hackMessage = [
        {
          path: testPath,
          descr: 'message',
          line: 1,
          start: 3,
          end: 4,
          code: 1234,
        },
        {
          path: 'otherPath',
          descr: 'more message',
          line: 5,
          start: 7,
          end: 8,
          code: 4321,
        },
      ];

      const expectedOutput = {
        scope: 'file',
        providerName: 'Hack: 1234',
        type: 'Error',
        text: 'message',
        filePath: testPath,
        range: new Range([0, 2], [0, 4]),
        trace: [
          {
            type: 'Trace',
            filePath: 'otherPath',
            text: 'more message',
            range: new Range([4, 6], [4, 8]),
          },
        ],
      };

      const output = hackMessageToDiagnosticMessage(hackMessage);
      expect(output).toEqual(expectedOutput);
    });
  });
});
