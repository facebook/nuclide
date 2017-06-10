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

import {setUseLocalRpc} from '../lib/service-manager';

describe('setUseLocalRpc', () => {
  it('successfully loads all the services', () => {
    expect(() => setUseLocalRpc(true)).not.toThrow();
  });
});
