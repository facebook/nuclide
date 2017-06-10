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
  addRemoteProject,
  startNuclideServer,
  stopNuclideServer,
} from './utils/integration-test-helpers';
import {generateHgRepo1Fixture} from '../pkg/nuclide-test-helpers';
import invariant from 'assert';

describe('remote connection for testing', () => {
  it('starts server and adds remote project', () => {
    waitsForPromise({timeout: 240000}, async () => {
      expect(atom.project.getDirectories().length).toBe(1);
      expect(atom.project.getRepositories().length).toBe(1);

      jasmineIntegrationTestSetup();

      expect(atom.project.getDirectories().length).toBe(0);
      expect(atom.project.getRepositories().length).toBe(0);

      await activateAllPackages();

      expect(atom.project.getDirectories().length).toBe(0);
      expect(atom.project.getRepositories().length).toBe(0);

      const pathToProject = await generateHgRepo1Fixture();

      startNuclideServer();
      const connection = await addRemoteProject(pathToProject);
      invariant(connection != null);

      expect(atom.project.getDirectories().length).toBe(1);
      expect(atom.project.getRepositories().length).toBe(1);

      await stopNuclideServer(connection);

      deactivateAllPackages();
    });
  });
});
