/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {
  DebuggerLaunchAttachProvider,
  NuclideDebuggerProvider,
} from 'nuclide-debugger-common';
import type {IDebugService} from './types';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Emitter} from 'atom';
import nuclideUri from 'nuclide-commons/nuclideUri';

export const WORKSPACE_VIEW_URI = 'atom://nuclide/debugger';

const CONNECTIONS_UPDATED_EVENT = 'CONNECTIONS_UPDATED_EVENT';
const PROVIDERS_UPDATED_EVENT = 'PROVIDERS_UPDATED_EVENT';

/**
 * Atom ViewProvider compatible model object.
 */
export default class DebuggerModel {
  _disposables: UniversalDisposable;
  _service: IDebugService;
  _emitter: Emitter;

  // Debugger providers
  _debuggerProviders: Set<NuclideDebuggerProvider>;
  _connections: Array<string>;

  constructor(service: IDebugService) {
    this._service = service;

    this._emitter = new Emitter();
    this._debuggerProviders = new Set();
    // There is always a local connection.
    this._connections = ['local'];

    this._disposables = new UniversalDisposable(this._listenForProjectChange());
  }

  _listenForProjectChange(): IDisposable {
    return atom.project.onDidChangePaths(() => {
      this._updateConnections();
    });
  }

  /**
   * Utility for getting refreshed connections.
   * TODO: refresh connections when new directories are removed/added in file-tree.
   */
  _updateConnections(): void {
    const connections = this._getRemoteConnections();
    // Always have one single local connection.
    connections.push('local');
    this._connections = connections;
    this._emitter.emit(CONNECTIONS_UPDATED_EVENT);
  }

  /**
   * Get remote connections without duplication.
   */
  _getRemoteConnections(): Array<string> {
    // TODO: move this logic into RemoteConnection package.
    return atom.project
      .getPaths()
      .filter(path => {
        return nuclideUri.isRemote(path);
      })
      .map(remotePath => {
        const {hostname} = nuclideUri.parseRemoteUri(remotePath);
        return nuclideUri.createRemoteUri(hostname, '/');
      })
      .filter((path, index, inputArray) => {
        return inputArray.indexOf(path) === index;
      });
  }

  dispose() {
    this._disposables.dispose();
  }

  addDebuggerProvider(provider: NuclideDebuggerProvider): void {
    this._debuggerProviders.add(provider);
    this._emitter.emit(PROVIDERS_UPDATED_EVENT);
  }

  removeDebuggerProvider(provider: NuclideDebuggerProvider): void {
    this._debuggerProviders.delete(provider);
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
}
