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

export type TestRunnerParams = {
  /** Absolute paths to tests to run. Could be paths to files or directories. */
  testPaths: Array<string>,
  /** A boolean indicating whether or not the tests are running headless. */
  headless: boolean,
  /** Creates the `atom` global object. */
  buildAtomEnvironment: (params: BuildAtomEnvironmentParams) => AtomGlobal,
  /** Currently undocumented, but seemingly necessary to use buildAtomEnvironment(). */
  buildDefaultApplicationDelegate: () => Object,
  /** An optional path to a log file to which test output should be logged. */
  logFile: ?string,
  /** Unclear what the contract of this is, but we will not be using it. */
  legacyTestRunner: () => void,
};

export type BuildAtomEnvironmentParams = {
  applicationDelegate: Object,
  window: Object,
  document: Object,
  configDirPath?: string,
  enablePersistence?: boolean,
};

export type ExitCode = number;
