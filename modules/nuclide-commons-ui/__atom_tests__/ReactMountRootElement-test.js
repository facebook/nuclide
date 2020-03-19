/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 * @emails oncall+nuclide
 */
const modulePath = require.resolve('../ReactMountRootElement');

describe('ReactMountRootElement', () => {
  it('works when required twice', () => {
    const element1 = require(modulePath).default;
    delete require.cache[modulePath];
    const element2 = require(modulePath).default;
    expect(element1).toBe(element2);
    // Make sure this doesn't throw.
    const createdElement = new element2();
    expect(createdElement.constructor.name).toBe('ReactMountRootElement');
  });
});
