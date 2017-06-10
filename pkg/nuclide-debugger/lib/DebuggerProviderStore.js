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

import type {DebuggerLaunchAttachProvider} from '../../nuclide-debugger-base';
import type {
  NuclideDebuggerProvider,
} from '../../nuclide-debugger-interfaces/service';
import type DebuggerActions from './DebuggerActions';
import type DebuggerDispatcher, {DebuggerAction} from './DebuggerDispatcher';

import {CompositeDisposable, Disposable, Emitter} from 'atom';
import {ActionTypes} from './DebuggerDispatcher';

const CONNECTIONS_UPDATED_EVENT = 'CONNECTIONS_UPDATED_EVENT';
const PROVIDERS_UPDATED_EVENT = 'PROVIDERS_UPDATED_EVENT';

/**
 * Flux style store holding all data related to debugger provider.
 */
export class DebuggerProviderStore {
  _dispatcher: DebuggerDispatcher;
  _disposables: CompositeDisposable;
  _debuggerActions: DebuggerActions;
  _emitter: Emitter;
  _debuggerProviders: Set<NuclideDebuggerProvider>;
  _connections: Array<string>;

  constructor(
    dispatcher: DebuggerDispatcher,
    debuggerActions: DebuggerActions,
  ) {
    this._dispatcher = dispatcher;
    this._disposables = new CompositeDisposable(
      this._registerDispatcherEvents(),
      this._listenForProjectChange(),
    );
    this._debuggerActions = debuggerActions;
    this._emitter = new Emitter();
    this._debuggerProviders = new Set();
    // There is always a local connection.
    this._connections = ['local'];
  }

  _registerDispatcherEvents(): IDisposable {
    const dispatcherToken = this._dispatcher.register(
      this._handlePayload.bind(this),
    );
    return new Disposable(() => this._dispatcher.unregister(dispatcherToken));
  }

  _listenForProjectChange(): IDisposable {
    return atom.project.onDidChangePaths(() => {
      this._debuggerActions.updateConnections();
    });
  }

  dispose() {
    this._disposables.dispose();
  }

  /**
   * Subscribe to new connection updates from DebuggerActions.
   */
  onConnectionsUpdated(callback: () => void): IDisposable {
    return this._emitter.on(CONNECTIONS_UPDATED_EVENT, callback);
  }

  onProvidersUpdated(callback: () => void): IDisposable {
    return this._emitter.on(PROVIDERS_UPDATED_EVENT, callback);
  }

  getConnections(): Array<string> {
    return this._connections;
  }

  /**
   * Return available launch/attach provider for input connection.
   * Caller is responsible for disposing the results.
   */
  getLaunchAttachProvidersForConnection(
    connection: string,
  ): Array<DebuggerLaunchAttachProvider> {
    const availableLaunchAttachProviders = [];
    for (const provider of this._debuggerProviders) {
      const launchAttachProvider = provider.getLaunchAttachProvider(connection);
      if (launchAttachProvider != null) {
        availableLaunchAttachProviders.push(launchAttachProvider);
      }
    }
    return availableLaunchAttachProviders;
  }

  _handlePayload(payload: DebuggerAction) {
    switch (payload.actionType) {
      case ActionTypes.ADD_DEBUGGER_PROVIDER:
        if (this._debuggerProviders.has(payload.data)) {
          return;
        }
        this._debuggerProviders.add(payload.data);
        this._emitter.emit(PROVIDERS_UPDATED_EVENT);
        break;
      case ActionTypes.REMOVE_DEBUGGER_PROVIDER:
        if (!this._debuggerProviders.has(payload.data)) {
          return;
        }
        this._debuggerProviders.delete(payload.data);
        break;
      case ActionTypes.UPDATE_CONNECTIONS:
        this._connections = payload.data;
        this._emitter.emit(CONNECTIONS_UPDATED_EVENT);
        break;
    }
  }
}
