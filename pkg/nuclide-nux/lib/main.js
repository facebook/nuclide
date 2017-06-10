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

import {CompositeDisposable, Disposable} from 'atom';
import invariant from 'assert';

import {NuxManager} from './NuxManager';
import {NuxStore} from './NuxStore';

import type {NuxTourModel} from './NuxModel';

export type RegisterNux = (nux: NuxTourModel) => Disposable;
export type TriggerNux = (id: number) => void;
export type SyncCompletedNux = (id: number) => void;

class Activation {
  _disposables: CompositeDisposable;
  _nuxStore: NuxStore;
  _nuxManager: NuxManager;
  _syncCompletedNuxService: SyncCompletedNux;

  constructor(): void {
    this._disposables = new CompositeDisposable();
    this._nuxStore = new NuxStore();
    this._nuxManager = new NuxManager(
      this._nuxStore,
      this._syncCompletedNux.bind(this),
    );

    this._disposables.add(this._nuxStore);
    this._disposables.add(this._nuxManager);
  }

  dispose(): void {
    this._serializeAndPersist();
    this._disposables.dispose();
  }

  _serializeAndPersist(): void {
    this._nuxStore.serialize();
  }

  addNewNux(nux: NuxTourModel): Disposable {
    return this._nuxManager.addNewNux(nux);
  }

  tryTriggerNux(id: number): void {
    this._nuxManager.tryTriggerNux(id);
  }

  setSyncCompletedNuxService(syncCompletedNuxService: SyncCompletedNux): void {
    this._syncCompletedNuxService = syncCompletedNuxService;
  }

  _syncCompletedNux(id: number): void {
    if (this._syncCompletedNuxService == null) {
      return;
    }
    this._syncCompletedNuxService(id);
  }
}

let activation: ?Activation = null;

export function activate(): void {
  if (activation == null) {
    activation = new Activation();
  }
}

export function deactivate(): void {
  if (activation != null) {
    activation.dispose();
    activation = null;
  }
}

export function provideRegisterNuxService(): RegisterNux {
  return (nux: NuxTourModel): Disposable => {
    if (activation == null) {
      throw new Error('An error occurred when instantiating the NUX package.');
    }
    if (nux == null) {
      throw new Error('Cannot register a "null" NuxTour.');
    }
    return activation.addNewNux(nux);
  };
}

export function provideTriggerNuxService(): TriggerNux {
  return (id: number): void => {
    if (activation == null) {
      throw new Error('An error occurred when instantiating the NUX package.');
    }
    activation.tryTriggerNux(id);
  };
}

export function consumeSyncCompletedNuxService(
  syncCompletedNuxService: SyncCompletedNux,
): void {
  invariant(activation != null);
  activation.setSyncCompletedNuxService(syncCompletedNuxService);
}
