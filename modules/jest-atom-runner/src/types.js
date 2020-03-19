/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

export type GlobalConfig = {
  maxWorkers: number,
  watch: boolean,
  watchAll: boolean,
};
export type ProjectConfig = {};
export type Resolver = {};
export type RawModuleMap = {};

export type Context = {
  moduleMap: {
    getRawModuleMap(): RawModuleMap,
  },
  config: ProjectConfig,
};
export type Test = {
  context: Context,
  path: string,
};

export type Watcher = any;

export type TestResult = {
  console: ?Array<any>,
  failureMessage: ?string,
  numFailingTests: number,
  numPassingTests: number,
  numPendingTests: number,
  perfStats: {end: number, start: number},
  snapshot: {
    added: number,
    fileDeleted: boolean,
    matched: number,
    unchecked: number,
    unmatched: number,
    updated: number,
    uncheckedKeys: Array<any>,
  },
  testFilePath: string,
  testResults: Array<{
    ancestorTitles: Array<string>,
    duration: number,
    failureMessages: Array<any>,
    fullName: string,
    location: any,
    numPassingAsserts: number,
    status: 'passed' | 'failed' | 'skipped',
    title: string,
  }>,
  sourceMaps: {},
  skipped: boolean,
  displayName: string,
  leaks: boolean,
  testExecError: ?string,
};
