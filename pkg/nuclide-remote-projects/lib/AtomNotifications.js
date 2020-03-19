/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

type raiseNativeNotificationFunc = ?(
  title: string,
  body: string,
  timeout: number,
  raiseIfAtomHasFocus: boolean,
) => ?IDisposable;

let _raiseNativeNotification: ?raiseNativeNotificationFunc = null;

export function setNotificationService(
  raiseNativeNotification: raiseNativeNotificationFunc,
): void {
  _raiseNativeNotification = raiseNativeNotification;
}

export function getNotificationService(): ?raiseNativeNotificationFunc {
  return _raiseNativeNotification;
}
