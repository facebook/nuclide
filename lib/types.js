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

// http://flight-manual.atom.io/hacking-atom/sections/writing-specs/#customizing-your-test-runner
export type TestRunnerParams = {
  /** Absolute paths to tests to run. Could be paths to files or directories. */
  testPaths: Array<string>,
  /** Creates the `atom` global object. */
  buildAtomEnvironment: (params: BuildAtomEnvironmentParams) => AtomGlobal,
  /** Currently undocumented, but seemingly necessary to use buildAtomEnvironment(). */
  buildDefaultApplicationDelegate: () => Object,
  /** An optional path to a log file to which test output should be logged. */
  logFile: ?string,
  /** A boolean indicating whether or not the tests are running headless. */
  headless: boolean,
  /** The legacy Jasmine runner */
  legacyTestRunner: (params: LegacyTestRunnerParams) => Promise<ExitCode>,
};

// https://github.com/atom/atom/blob/v1.6.2/spec/jasmine-test-runner.coffee
export type LegacyTestRunnerParams = {
  logFile: ?string,
  headless: boolean,
  testPaths: Array<string>,
  buildAtomEnvironment: (params: BuildAtomEnvironmentParams) => AtomGlobal,
};

export type BuildAtomEnvironmentParams = {
  applicationDelegate: Object,
  window: Object,
  document: Object,
  configDirPath?: string,
  enablePersistence?: boolean,
};

export type ExitCode = number;
