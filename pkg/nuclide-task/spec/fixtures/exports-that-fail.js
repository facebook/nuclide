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

// eslint-disable-next-line rulesdir/no-commonjs
module.exports = {
  throwsErrorSynchronously(): void {
    // TODO(mbolin): If throws a string rather than an Error, the unit test
    // fails.
    throw Error('All I do is fail.');
  },

  returnsRejectedPromise(): Promise<any> {
    // TODO(mbolin): If this passes a string rather than an Error, the unit test
    // fails.
    return Promise.reject(Error('Explicit fail with rejected Promise.'));
  },

  async asyncFunctionThatThrows(): Promise<void> {
    // TODO(mbolin): If throws a string rather than an Error, the unit test
    // fails.
    throw Error('All I do is fail *asynchronously*.');
  },
};
