/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import {
  activateAllPackages,
  deactivateAllPackages,
  jasmineIntegrationTestSetup,
} from './utils/integration-test-helpers';

describe('activate/deactivate all packages', () => {
  it('activates and deactivates packages correctly and without hanging', () => {
    waitsForPromise({timeout: 240000}, async () => {
      jasmineIntegrationTestSetup();
      expect(atom.packages.getActivePackages().length).toBe(0);
      const activatedPackages = await activateAllPackages();
      expect(activatedPackages.length).toBeGreaterThan(20); // Inaccurate, just a sanity check.
      expect(activatedPackages.indexOf('nuclide') >= 0).toBe(true);
      expect(activatedPackages.indexOf('autocomplete-plus') >= 0).toBe(true);
      await deactivateAllPackages();
      expect(atom.packages.getActivePackages().length).toBe(0);
    });
  });
});
