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

import type {BusySignalProvider} from './types';
import type {StatusBarTile as StatusBarTileType} from './StatusBarTile';
import type {MessageDisplayOptions} from './BusySignalProviderBase';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import createPackage from 'nuclide-commons-atom/createPackage';
import {MessageStore} from './MessageStore';

import {DedupedBusySignalProviderBase} from './DedupedBusySignalProviderBase';
import {StatusBarTile} from './StatusBarTile';

export type BusySignalService = {
  // Activates the busy signal with the given message and returns the promise
  // from the provided callback.
  // The busy signal automatically deactivates when the returned promise
  // either resolves or rejects.
  reportBusyWhile<T>(
    message: string,
    f: () => Promise<T>,
    options?: MessageDisplayOptions,
  ): Promise<T>,

  // Activates the busy signal with the given message.
  // The returned disposable/subscription can be dispose()d or unsubscribe()d
  // to deactivate the given busy message.
  reportBusy(
    message: string,
    options?: MessageDisplayOptions,
  ): IDisposable & rxjs$ISubscription,

  // Call this when you're done to ensure that all busy signals are removed.
  dispose(): void,
};

class Activation {
  _statusBarTile: ?StatusBarTileType;
  _disposables: UniversalDisposable;
  _messageStore: MessageStore;

  constructor() {
    this._disposables = new UniversalDisposable();
    this._messageStore = new MessageStore();
  }

  dispose() {
    this._disposables.dispose();
  }

  consumeStatusBar(statusBar: atom$StatusBar): IDisposable {
    const statusBarTile = (this._statusBarTile = new StatusBarTile());
    statusBarTile.consumeMessageStream(this._messageStore.getMessageStream());
    const disposable = new UniversalDisposable(() => {
      if (this._statusBarTile) {
        this._statusBarTile.dispose();
        this._statusBarTile = null;
      }
    });
    statusBarTile.consumeStatusBar(statusBar);
    this._disposables.add(disposable);
    return disposable;
  }

  consumeBusySignalProvider(provider: BusySignalProvider): IDisposable {
    const disposable = this._messageStore.consumeProvider(provider);
    this._disposables.add(disposable);
    return disposable;
  }

  provideBusySignal(): BusySignalService {
    const busySignal = new DedupedBusySignalProviderBase();
    const disposable = this._messageStore.consumeProvider(busySignal);
    this._disposables.add(disposable);
    return {
      // TODO: clean up the backing provider to be more consistent.
      reportBusyWhile<T>(message, f: () => Promise<T>, options): Promise<T> {
        return busySignal.reportBusy(message, f, options);
      },
      reportBusy(message, options) {
        return busySignal.displayMessage(message, options);
      },
      dispose: () => {
        disposable.dispose();
        this._disposables.remove(disposable);
      },
    };
  }
}

createPackage(module.exports, Activation);
