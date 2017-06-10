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
import type {Observable} from 'rxjs';

/**
 * Test run status values as defined in
 * {@link https://phabricator.intern.facebook.com/diffusion/E/browse/tfb/trunk/www/flib/intern/testinfra/model/TR_Result.php TR_Result}.
 *
 *     {
 *       PASSED: 1,
 *       FAILED: 2,
 *       SKIPPED: 3,
 *       FATAL: 4,
 *       TIMEOUT: 5,
 *     }
 */
export type TestRunStatus = 1 | 2 | 3 | 4 | 5;

export type TestClassSummary = {
  className: string,
  fileName: string,
  id: number,
  name?: string,
};

export type TestRunInfo = {
  details?: string,
  durationSecs: number,
  endedTime?: number,
  name: string,
  numAssertions: number,
  numFailures: number,
  numMethods: number,
  numSkipped: number,
  status: TestRunStatus,
  summary?: string,
  test_json?: TestClassSummary,
};

// did-start
export type StartMessage = {
  kind: 'start',
};
// did-run-summary
export type SummaryMessage = {
  kind: 'summary',
  summaryInfo: Array<TestClassSummary>,
};
// did-run-test
export type RunTestMessage = {
  kind: 'run-test',
  testInfo: TestRunInfo,
};
// stderr-data
export type StderrMessage = {
  kind: 'stderr',
  data: string,
};
// stdout-data
export type StdoutMessage = {
  kind: 'stdout',
  data: string,
};
// error
export type ErrorMessage = {
  kind: 'error',
  error: Object,
};

export type Message =
  | StartMessage
  | SummaryMessage
  | RunTestMessage
  | StderrMessage
  | StdoutMessage
  | ErrorMessage;

export type TestRunner = {
  label: string,
  runTest: (filePath: NuclideUri) => Observable<Message>,
  attachDebugger?: (filePath: NuclideUri) => Promise<void>,
  debuggerProviderName?: string,
};
