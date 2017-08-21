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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

export type BusySignalOptions = {|
  // Can say that a busy signal will only appear when a given file is open.
  // Default = null, meaning the busy signal applies to all files.
  onlyForFile?: NuclideUri,
  // Is user waiting for computer to finish a task? (traditional busy spinner)
  // or is the computer waiting for user to finish a task? (action required)
  // Default = spinner.
  waitingFor?: 'computer' | 'user',
  // Debounce it? default = true for busy-signal, and false for action-required.
  debounce?: boolean,
  // If onClick is set, then the tooltip will be clickable. Default = null.
  onDidClick?: () => void,
|};

export type BusySignalService = {
  // Activates the busy signal with the given title and returns the promise
  // from the provided callback.
  // The busy signal automatically deactivates when the returned promise
  // either resolves or rejects.
  reportBusyWhile<T>(
    title: string,
    f: () => Promise<T>,
    options?: BusySignalOptions,
  ): Promise<T>,

  // Activates the busy signal. Set the title in the returned BusySignal
  // object (you can update the title multiple times) and dispose it when done.
  reportBusy(title: string, options?: BusySignalOptions): BusyMessage,

  // This is a no-op. When someone consumes the busy service, they get back a
  // reference to the single shared instance, so disposing of it would be wrong.
  dispose(): void,
};

export type BusyMessage = {
  // You can set/update the title.
  setTitle(title: string): void,
  // Dispose of the signal when done to make it go away.
  dispose(): void,
};
