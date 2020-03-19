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

/**
 * This designed for logging on both Nuclide client and Nuclide server. It is based on [log4js]
 * (https://www.npmjs.com/package/log4js) with the ability to lazy initialize and update config
 * after initialized.
 * To make sure we only have one instance of log4js logger initialized globally, we save the logger
 * to `global` object.
 */

import type {SessionInfo} from 'nuclide-commons/analytics';

import log4js from 'log4js';

import {setRawAnalyticsService} from 'nuclide-commons/analytics';
import * as rawAnalyticsService from 'nuclide-analytics/lib/track';

import once from 'nuclide-commons/once';
import {getDefaultConfig, getPathToLogDir, getPathToLogFile} from './config';
import {Observable} from 'rxjs';

export {getDefaultConfig, getPathToLogDir, getPathToLogFile};

export function flushLogsAndExit(exitCode: number): void {
  log4js.shutdown(() => process.exit(exitCode));
}

export function flushLogsAndAbort(): void {
  log4js.shutdown(() => process.abort());
}

/**
 * Push initial default config to log4js.
 * Execute only once.
 */
// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export const initializeLogging = once(() => {
  setupLoggingService();
  log4js.configure(getDefaultConfig());
});

export function setupLoggingService(): void {
  let obs: Observable<SessionInfo> = Observable.from([]);

  try {
    // $FlowFB
    obs = require('../../fb-appsession-observer').observeApplicationSession();
  } catch (_) {}

  setRawAnalyticsService(rawAnalyticsService, obs);
}
