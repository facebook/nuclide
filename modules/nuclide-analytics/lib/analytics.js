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

import type {SessionInfo} from 'nuclide-commons/analytics';
import {Observable} from 'rxjs';

// This is a stubbed implementation that other packages use to record analytics data & performance.
export function track(
  eventName: string,
  values?: {[key: string]: mixed},
  immediate?: boolean,
): ?Promise<mixed> {}

// Other packages can check this to avoid doing work that will be ignored
// anyway by the stubbed track implementation.
export function isTrackSupported(): boolean {
  return false;
}

export function setApplicationSessionObservable(
  ob: Observable<SessionInfo>,
): void {}
