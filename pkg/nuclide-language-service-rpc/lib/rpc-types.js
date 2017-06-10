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

import {ConnectableObservable} from 'rxjs';

export type ShowNotificationLevel = 'info' | 'log' | 'warning' | 'error';

// This interface is exposed by the client to the server
export interface HostServices {
  consoleNotification(
    source: string,
    level: ShowNotificationLevel,
    text: string,
  ): void,

  dialogNotification(
    level: ShowNotificationLevel,
    text: string,
  ): ConnectableObservable<void>,

  dialogRequest(
    level: ShowNotificationLevel,
    text: string,
    buttonLabels: Array<string>,
    closeLabel: string,
  ): ConnectableObservable<string>,

  dispose(): void,

  // Internal implementation method. Normally we'd keep it private.
  // But we need it to be remotable across NuclideRPC, so it must be public.
  childRegister(child: HostServices): Promise<HostServices>,
}
