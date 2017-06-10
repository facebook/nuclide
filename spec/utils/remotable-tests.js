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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {RemoteConnection} from '../../pkg/nuclide-remote-connection';

import {
  addRemoteProject,
  activateAllPackages,
  jasmineIntegrationTestSetup,
  deactivateAllPackages,
  startNuclideServer,
  stopNuclideServer,
} from './integration-test-helpers';
import {setLocalProject} from '../../pkg/commons-atom/testHelpers';
import nuclideUri from 'nuclide-commons/nuclideUri';
import fsPromise from 'nuclide-commons/fsPromise';
import invariant from 'assert';

export type TestContext = {
  setProject(localProjectPath: string): Promise<void>,
  getProjectRelativePath(relativePath: string): NuclideUri,
};

class LocalTestContext {
  _projectPath: ?string;

  constructor() {
    this._projectPath = null;

    beforeEach(() => {
      waitsForPromise({label: 'local test setup'}, async () => {
        jasmineIntegrationTestSetup();
        await activateAllPackages();
      });
    });

    afterEach(() => {
      if (this._projectPath != null) {
        setLocalProject([]);
        this._projectPath = null;
      }
      deactivateAllPackages();
    });
  }

  async setProject(projectPath: string): Promise<void> {
    // Nuclide doesn't officially support mounting symlinks as projects,
    // as some of its dependencies, such as Flow, return canonicalized paths.
    // Therefore, we canonicalize projects paths in tests:
    const resolvedProjectPath = await fsPromise.realpath(projectPath);
    invariant(this._projectPath == null, 'Call setProject exactly once');
    setLocalProject(resolvedProjectPath);
    this._projectPath = resolvedProjectPath;
    return Promise.resolve();
  }

  getProjectRelativePath(relativePath: string): NuclideUri {
    invariant(this._projectPath != null, 'Must call setProject first');
    return nuclideUri.join(this._projectPath, relativePath);
  }
}

class RemoteTestContext {
  _localProjectPath: ?string;
  _remoteProjectPath: ?NuclideUri;
  _connection: ?RemoteConnection;

  constructor() {
    this._remoteProjectPath = null;

    beforeEach(() => {
      // Proxy parsing, generation, and loading is slow. This timeout covers
      // the average case. Blocks that need more time can specify it themselves.
      jasmine.getEnv().defaultTimeoutInterval = 10000;
      waitsForPromise({label: 'remote test setup'}, async () => {
        jasmineIntegrationTestSetup();
        await activateAllPackages();
      });
    });

    afterEach(() => {
      waitsForPromise({label: 'remote test cleanup'}, async () => {
        if (this._connection != null) {
          await stopNuclideServer(this._connection);
          this._connection = null;
          this._remoteProjectPath = null;
        }
        deactivateAllPackages();
      });
    });
  }

  async setProject(localProjectPath: string): Promise<void> {
    invariant(this._remoteProjectPath == null, 'Call setProject exactly once');
    startNuclideServer();
    const connection = await addRemoteProject(localProjectPath);
    invariant(connection != null, 'connection was not established');
    this._connection = connection;
    this._remoteProjectPath = connection.getUriForInitialWorkingDirectory();
    invariant(this._remoteProjectPath != null, 'Remote project path not set');
  }

  getProjectRelativePath(relativePath: string): NuclideUri {
    invariant(this._remoteProjectPath != null, 'Must call setProject first');
    return nuclideUri.join(this._remoteProjectPath, relativePath);
  }
}

function getDescribeFunction(focus: boolean): Function {
  // Guard against `fdescribe` usages in prod.
  if (focus && process.env.SANDCASTLE === '1') {
    // $FlowIgnore usage of `fdescribe`.
    fdescribe('Invalid usage of `focus` in production', () => {
      it('`fdescribe` not allowed in production', () => {
        throw new Error(
          'Expected `focus` to be `false`, but it was `true` in production',
        );
      });
    });
    return describe;
  }
  // $FlowIgnore usage of `fdescribe`.
  return focus ? fdescribe : describe;
}

// This function can be used in place of jasmine's describe.
// It will run the testDecription both locally and remotely.
// The provided testDescription must call context.setProject() exactly once
// and then use context.getProjectRelativePath() for relative file paths.
//
// Warning: running both tests in the same Atom instance may cause failures if the tests rely on
// some state that is not cleared. In that case, use describeRemote and describeLocal, below, in two
// separate integration test files.
export function describeRemotableTest(
  testName: string,
  testDescription: (context: TestContext) => void,
  focus?: boolean = false,
): void {
  describeLocal(testName, testDescription, focus);
  describeRemote(testName, testDescription, focus);
}

export function describeRemote(
  testName: string,
  testDescription: (context: TestContext) => void,
  focus?: boolean = false,
): void {
  getDescribeFunction(focus)('Remote ' + testName, () => {
    testDescription(new RemoteTestContext());
  });
}

export function describeLocal(
  testName: string,
  testDescription: (context: TestContext) => void,
  focus?: boolean = false,
): void {
  getDescribeFunction(focus)('Local ' + testName, () => {
    testDescription(new LocalTestContext());
  });
}
