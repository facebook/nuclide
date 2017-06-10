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

import type {Observable} from 'rxjs';
import type {OutputService} from '../../nuclide-console/lib/types';

type raiseNativeNotificationFunc = ?(
  title: string,
  body: string,
  timeout: number,
  raiseIfAtomHasFocus: boolean,
) => ?IDisposable;

let _outputServiceApi: ?OutputService = null;
let _raiseNativeNotification: ?raiseNativeNotificationFunc = null;

export function setOutputService(api: OutputService): void {
  _outputServiceApi = api;
}

export function getOutputService(): ?OutputService {
  return _outputServiceApi;
}

export function setNotificationService(
  raiseNativeNotification: raiseNativeNotificationFunc,
): void {
  _raiseNativeNotification = raiseNativeNotification;
}

export function getNotificationService(): ?raiseNativeNotificationFunc {
  return _raiseNativeNotification;
}

export function registerConsoleLogging(
  sourceId: string,
  userOutputStream: Observable<string>,
): ?IDisposable {
  const api = getOutputService();
  let outputDisposable = null;
  if (api != null) {
    outputDisposable = api.registerOutputProvider({
      id: sourceId,
      messages: userOutputStream.map(message => JSON.parse(message)),
    });
  }
  return outputDisposable;
}
