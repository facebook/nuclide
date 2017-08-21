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

import type {
  CallbackDiagnosticProvider,
  LinterProvider,
  ObservableDiagnosticProvider,
  RegisterIndieLinter,
  Store,
} from './types';
import type {LinterAdapter} from './services/LinterAdapter';

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import MessageRangeTracker from './MessageRangeTracker';
import DiagnosticUpdater from './services/DiagnosticUpdater';
import IndieLinterRegistry from './services/IndieLinterRegistry';
import {createAdapters} from './services/LinterAdapterFactory';
import ObservableDiagnosticUpdater from './services/ObservableDiagnosticUpdater';
import * as Actions from './redux/Actions';
import createStore from './redux/createStore';

class Activation {
  _disposables: UniversalDisposable;
  _allLinterAdapters: Set<LinterAdapter>;
  _store: Store;

  constructor() {
    this._allLinterAdapters = new Set();

    const messageRangeTracker = new MessageRangeTracker();
    this._store = createStore(messageRangeTracker);

    this._disposables = new UniversalDisposable(messageRangeTracker, () => {
      this._allLinterAdapters.forEach(adapter => adapter.dispose());
      this._allLinterAdapters.clear();
    });
  }

  dispose() {
    this._disposables.dispose();
  }

  /**
   * @return A wrapper around the methods on DiagnosticStore that allow reading data.
   */
  provideDiagnosticUpdates(): DiagnosticUpdater {
    return new DiagnosticUpdater(this._store);
  }

  provideObservableDiagnosticUpdates(): ObservableDiagnosticUpdater {
    return new ObservableDiagnosticUpdater(this._store);
  }

  provideIndie(): RegisterIndieLinter {
    const registry = new IndieLinterRegistry();
    this._disposables.add(registry);
    return config => {
      const delegate = registry.register(config);
      const disposable = this.consumeDiagnosticsProviderV2(delegate);
      delegate.onDidDestroy(() => {
        disposable.dispose();
      });
      return delegate;
    };
  }

  consumeLinterProvider(
    provider: LinterProvider | Array<LinterProvider>,
  ): IDisposable {
    const newAdapters = createAdapters(provider);
    const adapterDisposables = new UniversalDisposable();
    for (const adapter of newAdapters) {
      this._allLinterAdapters.add(adapter);
      const diagnosticDisposable = this.consumeDiagnosticsProviderV2({
        updates: adapter.getUpdates(),
        invalidations: adapter.getInvalidations(),
      });
      adapterDisposables.add(() => {
        diagnosticDisposable.dispose();
        adapter.dispose();
        this._allLinterAdapters.delete(adapter);
      });
    }
    return adapterDisposables;
  }

  consumeDiagnosticsProviderV1(
    provider: CallbackDiagnosticProvider,
  ): IDisposable {
    // Register the diagnostic store for updates from the new provider.
    const observableProvider = {
      updates: observableFromSubscribeFunction(
        provider.onMessageUpdate.bind(provider),
      ),
      invalidations: observableFromSubscribeFunction(
        provider.onMessageInvalidation.bind(provider),
      ),
    };
    return this.consumeDiagnosticsProviderV2(observableProvider);
  }

  consumeDiagnosticsProviderV2(
    provider: ObservableDiagnosticProvider,
  ): IDisposable {
    this._store.dispatch(Actions.addProvider(provider));
    return new UniversalDisposable(() => {
      this._store.dispatch(Actions.removeProvider(provider));
    });
  }
}

createPackage(module.exports, Activation);
