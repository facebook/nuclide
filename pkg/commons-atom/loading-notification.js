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

import {triggerAfterWait} from 'nuclide-commons/promise';

/**
 * Displays a loading notification while waiting for a promise.
 * Waits delayMs before actually showing the notification (to prevent flicker).
 */
export default function loadingNotification<T>(
  promise: Promise<T>,
  message: string,
  delayMs: number = 100,
  options: Object = {},
): Promise<T> {
  let notif = null;
  const timeoutFn = () => {
    notif = atom.notifications.addInfo(message, {
      dismissable: true,
      ...options,
    });
  };
  const cleanupFn = () => {
    if (notif) {
      notif.dismiss();
    }
  };
  return triggerAfterWait(promise, delayMs, timeoutFn, cleanupFn);
}
