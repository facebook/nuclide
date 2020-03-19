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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';

export type ShowNotificationLevel = 'info' | 'log' | 'warning' | 'error';

// This interface is exposed by the client to the server
export interface HostServices {
  consoleNotification(
    source: string,
    level: ShowNotificationLevel,
    text: string,
  ): void;

  dialogNotification(
    level: ShowNotificationLevel,
    text: string,
  ): ConnectableObservable<void>;

  dialogRequest(
    level: ShowNotificationLevel,
    text: string,
    buttonLabels: Array<string>,
    closeLabel: string,
  ): ConnectableObservable<string>;

  // showProgress shows the busy spinner with a tooltip message that can update
  // over time. Use the returned Progress interface to update title if wanted,
  // and to dispose when done.
  showProgress(
    title: string,
    options?: {|debounce?: boolean|},
  ): Promise<Progress>;

  // showActionRequired shows an icon with the tooltip message. If clickable,
  // then the user can click on the message, which will generate a next().
  // Unsubscribe when done.
  showActionRequired(
    title: string,
    options?: {|clickable?: boolean|},
  ): ConnectableObservable<void>;

  dispose(): void;

  // Internal implementation method. Normally we'd keep it private.
  // But we need it to be remotable across NuclideRPC, so it must be public.
  childRegister(child: HostServices): Promise<HostServices>;

  applyTextEditsForMultipleFiles(
    changes: Map<NuclideUri, Array<TextEdit>>,
  ): Promise<boolean>;

  dispatchCommand(
    command: string,
    params: {|args: any, projectRoot: NuclideUri|},
  ): Promise<boolean>;
}

export interface Progress {
  setTitle(title: string): void;
  dispose(): void;
}
