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
  jasmineIntegrationTestSetup,
  deactivateAllPackages,
} from './utils/integration-test-helpers';
import {copyFixture} from '../pkg/nuclide-test-helpers';
import {setLocalProject} from '../pkg/commons-atom/testHelpers';
import {sleep} from 'nuclide-commons/promise';

describe('Task runner behavior', () => {
  beforeEach(() => {
    waitsForPromise({timeout: 60000}, async () => {
      jasmineIntegrationTestSetup();
      await activateAllPackages();
    });
  });

  afterEach(() => {
    deactivateAllPackages();
  });

  it('does not show task runner for empty projects', () => {
    waitsForPromise(async () => {
      const projectPath = await copyFixture('empty_project', __dirname);
      setLocalProject(projectPath);

      // wait for rendering
      await sleep(1000);
    });

    runs(() => {
      expect(isTaskRunnerVisible()).toBe(false);
    });
  });
});

function isTaskRunnerVisible(): boolean {
  const el = document.querySelector('.nuclide-task-runner-toolbar');
  return el != null && el.clientWidth > 0 && el.clientHeight > 0;
}
