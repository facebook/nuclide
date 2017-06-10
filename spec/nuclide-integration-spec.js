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
  activateAllPackages,
  deactivateAllPackages,
  jasmineIntegrationTestSetup,
} from './utils/integration-test-helpers';
import {sleep} from 'nuclide-commons/promise';

describe('nuclide', () => {
  it('deactivates cleanly', () => {
    waitsForPromise(async () => {
      jasmineIntegrationTestSetup();

      await activateAllPackages();
      await sleep(500);
      spyOn(console, 'error').andCallThrough();
      deactivateAllPackages();
      await sleep(500);

      // eslint-disable-next-line no-console
      console.error.argsForCall.forEach(args => {
        // If this test is failing for you, the easiest way to repro is to
        // "disable" Nuclide from the Settings view.
        expect(args[0]).not.toMatch(/^Error deactivating/i);
      });
    });
  });
});
