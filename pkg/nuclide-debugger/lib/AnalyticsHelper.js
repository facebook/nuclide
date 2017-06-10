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

import {startTracking} from '../../nuclide-analytics';

let timer = null;
export function beginTimerTracking(eventName: string) {
  timer = startTracking(eventName);
}

export function failTimerTracking(err: Error) {
  if (timer !== null) {
    timer.onError(err);
    timer = null;
  }
}

export function endTimerTracking() {
  if (timer !== null) {
    timer.onSuccess();
    timer = null;
  }
}
