/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
jest.setTimeout(70000);
import nullthrows from 'nullthrows';

import nuclideUri from 'nuclide-commons/nuclideUri';
import ClangFlagsManager from '../lib/ClangFlagsManager';
import {copyFixture} from '../../../pkg/nuclide-test-helpers';
import path from 'path';

let flagsManager: ClangFlagsManager;
let compilationDatabase;
let requestSettings;
let emptyRequestSettings;
let testDir;
beforeEach(async () => {
  global.performance.mark = jest.fn();
  global.performance.measure = jest.fn();
  global.performance.clearMarks = jest.fn();
  global.performance.clearMeasures = jest.fn();
  testDir = await copyFixture(
    'cpp_buck_project',
    path.resolve(__dirname, '../__mocks__'),
  );
  flagsManager = new ClangFlagsManager();
  compilationDatabase = {
    file: nuclideUri.join(testDir, 'compile_commands.json'),
    flagsFile: nuclideUri.join(testDir, 'BUCK'),
    libclangPath: null,
  };
  requestSettings = {
    compilationDatabase,
    projectRoot: null,
  };
  emptyRequestSettings = {
    compilationDatabase: null,
    projectRoot: null,
  };
});

it('gets flags for header files', async () => {
  let result = await flagsManager.getFlagsForSrc('header.h', requestSettings);
  const expectedFlags = ['g++', '-fPIC', '-O3', '-x', 'c++'];
  expect(nullthrows(result).flags).toEqual(expectedFlags);

  result = await flagsManager.getFlagsForSrc('header.hpp', requestSettings);
  expect(nullthrows(result).flags).toEqual(expectedFlags);

  // When headers are not properly owned, we should look for source files
  // in the same directory.
  result = await flagsManager.getFlagsForSrc(
    nuclideUri.join(testDir, 'testInternal.h'),
    emptyRequestSettings,
  );
  expect(nullthrows(result).flags).toEqual(expectedFlags);

  result = await flagsManager.getFlagsForSrc(
    nuclideUri.join(testDir, 'test-inl.h'),
    emptyRequestSettings,
  );
  expect(nullthrows(result).flags).toEqual(expectedFlags);

  result = await flagsManager.getFlagsForSrc(
    nuclideUri.join(testDir, 'test2.h'),
    emptyRequestSettings,
  );
  expect(nullthrows(result).flags).not.toBeNull();
});
