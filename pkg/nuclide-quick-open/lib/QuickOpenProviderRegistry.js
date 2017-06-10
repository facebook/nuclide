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

import type {
  Provider,
  DirectoryProviderType,
  GlobalProviderType,
} from './types';

import {Emitter} from 'atom';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export default class QuickOpenProviderRegistry {
  _emitter: Emitter;
  _subscriptions: UniversalDisposable;
  _directoryProviders: Map<string, DirectoryProviderType>;
  _globalProviders: Map<string, GlobalProviderType>;

  constructor() {
    this._emitter = new Emitter();
    this._subscriptions = new UniversalDisposable();
    this._directoryProviders = new Map();
    this._globalProviders = new Map();
  }

  getProviders(): Array<Provider> {
    return [
      ...this._globalProviders.values(),
      ...this._directoryProviders.values(),
    ];
  }

  getGlobalProviders(): Array<GlobalProviderType> {
    return [...this._globalProviders.values()];
  }

  getDirectoryProviders(): Array<DirectoryProviderType> {
    return [...this._directoryProviders.values()];
  }

  getProviderByName(serviceName: string): ?Provider {
    return (
      this._globalProviders.get(serviceName) ||
      this._directoryProviders.get(serviceName)
    );
  }

  getGlobalProviderByName(serviceName: string): ?GlobalProviderType {
    return this._globalProviders.get(serviceName);
  }

  getDirectoryProviderByName(serviceName: string): ?DirectoryProviderType {
    return this._directoryProviders.get(serviceName);
  }

  isProviderGlobal(serviceName: string): boolean {
    return this._globalProviders.has(serviceName);
  }

  observeProviders(callback: (service: Provider) => void): IDisposable {
    for (const provider of this.getProviders()) {
      callback(provider);
    }
    return this.onDidAddProvider(callback);
  }

  onDidAddProvider(callback: (service: Provider) => void): IDisposable {
    return this._emitter.on('did-add-provider', callback);
  }

  onDidRemoveProvider(callback: (service: Provider) => void): IDisposable {
    return this._emitter.on('did-remove-provider', callback);
  }

  addProvider(service: Provider): IDisposable {
    if (service.providerType === 'GLOBAL') {
      this._globalProviders.set(service.name, service);
    } else {
      this._directoryProviders.set(service.name, service);
    }
    const disposable = new UniversalDisposable(() => {
      if (service.providerType === 'GLOBAL') {
        this._globalProviders.delete(service.name);
      } else {
        this._directoryProviders.delete(service.name);
      }
      this._emitter.emit('did-remove-provider', service);
    });
    this._subscriptions.add(disposable);
    this._emitter.emit('did-add-provider', service);

    return disposable;
  }

  dispose(): void {
    this._emitter.dispose();
    this._subscriptions.dispose();
  }
}
