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

import {
  FrontendCommandHandler,
} from '../VendorLib/node-inspector/lib/FrontendCommandHandler';

describe('FrontendCommandHandler', () => {
  // This is something of an integration test: we dig into the internals a little bit in our Session
  // class so this test ensures we won't be surprised if it changes.
  it('supports registering noop commands', () => {
    expect(typeof FrontendCommandHandler.prototype._registerNoopCommands).toBe(
      'function',
    );
  });
});
