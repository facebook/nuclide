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
  jasmineIntegrationTestSetup,
  deactivateAllPackages,
} from './utils/integration-test-helpers';

describe('Example Integration Test', () => {
  beforeEach(() => {
    waitsForPromise(async () => {
      // Configure some jasmine specific things for integration testing.
      jasmineIntegrationTestSetup();
      // Activate nuclide packages.
      await activateAllPackages();
    });
  });

  afterEach(() => {
    // Deactivate nuclide packages.
    waitsForPromise(deactivateAllPackages);
  });

  it('tests my feature', () => {
    waitsForPromise(async () => {
      // Your testing code goes here....
      // See: https://github.com/facebook/nuclide/wiki/Writing-an-Integration-Test
      //      for instructions on how to write integration tests.
      // Also consider perusing the already-written tests in the top-level `spec/` directory.
      //
      // Some easy examples:
      // Want to click a button?  Just do
      //
      // const workspaceView = atom.views.getView(atom.workspace);
      //
      // const buttonView = workspaceView.querySelector('css-selector-goes-here');
      // buttonView.click();
      //
      // Want to simulate a keyboard shortcut?  Use the dispatchKeyboardEvent function from
      // nuclide-integration-test-helpers.  Just do
      //
      // dispatchKeyboardEvent('C', document.activeElement, {cmd: true, shift: true});
      //
      // Want to copy an already-made mercurial project to a temporary directory, and
      // add it as a project?  Use the fixtures library in nuclide-integration-test-helpers.
      // Just do
      //
      // const repoPath = await generateHgRepo1Fixture();
      // setLocalProject(repoPath);
      //
      // Do the same thing, but for a remote project by starting the nuclide server using
      // the remote-utils library in nuclide-integration-test-helpers.  Just do
      //
      // const repoPath = await generateHgRepo1Fixture();
      // startNuclideServer();
      // const connection = await addRemoteProject(repoPath);
      // ...
      // await stopNuclideServer(connection);
      //
      // For more examples look at integration tests in the top-level `spec/` directory.
    });
  });
});
