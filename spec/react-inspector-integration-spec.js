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

import nuclideUri from 'nuclide-commons/nuclideUri';
import {sleep} from 'nuclide-commons/promise';
import {
  jasmineIntegrationTestSetup,
  deactivateAllPackages,
} from './utils/integration-test-helpers';
import WS from 'ws';

// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {WORKSPACE_VIEW_URI} from '../pkg/nuclide-react-inspector/lib/ui/Inspector';

describe('React Native Inspector', () => {
  beforeEach(() => {
    waitsForPromise(async () => {
      // Configure some jasmine specific things for integration testing.
      jasmineIntegrationTestSetup();
      await atom.packages.activatePackage(
        nuclideUri.join(__dirname, '../pkg/nuclide-react-inspector'),
      );
    });
  });

  afterEach(() => {
    // Deactivate nuclide packages.
    waitsForPromise(deactivateAllPackages);
  });

  it('tries to connect to the RN app on port 8097', () => {
    // Activate the Inspector

    // eslint-disable-next-line nuclide-internal/atom-apis
    atom.workspace.open(WORKSPACE_VIEW_URI, {searchAllPanes: true});

    waitsForPromise({timeout: 3000}, async () => {
      // Keep trying to connect to the server.
      for (;;) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await tryToConnect();
          return;
        } catch (err) {
          // eslint-disable-next-line no-await-in-loop
          await sleep(500);
        }
      }
    });
  });
});

function tryToConnect(): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WS('ws://localhost:8097/devtools');
    ws.on('error', reject);
    ws.on('open', resolve);
  });
}
