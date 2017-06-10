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

import TestRunModel from '../lib/TestRunModel';

const TestRunStatus = TestRunModel.Status;

describe('TestRunModel', () => {
  describe('formatStatusMessage', () => {
    it('prints pretty pass message', () => {
      expect(
        TestRunModel.formatStatusMessage('Foo', 1.2, TestRunStatus.PASSED),
      ).toEqual(
        '      \u001B[32m✓\u001B[39m Foo 1.200s \u001B[32m(PASS)\u001B[39m',
      );
    });

    it('prints pretty fail message', () => {
      expect(
        TestRunModel.formatStatusMessage('Bar', 2.22555, TestRunStatus.FAILED),
      ).toEqual(
        '      \u001B[31m✗\u001B[39m Bar 2.226s \u001B[31m(FAIL)\u001B[39m',
      );
    });
  });
});
