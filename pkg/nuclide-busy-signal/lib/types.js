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

export type BusySignalMessage = BusySignalMessageBusy | BusySignalMessageDone;

export type BusySignalMessageBusy = {
  status: 'busy',
  // Must be unique to the provider. Used to cancel the message later.
  id: number,
  message: string,
};

export type BusySignalMessageDone = {
  status: 'done',
  // Cancel the busy signal with this identifier.
  id: number,
};

export type BusySignalProvider = {
  messages: Observable<BusySignalMessage>,
};
