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

import type {ConsoleService} from 'atom-ide-ui';
import type {SshTunnelService} from 'nuclide-adb/lib/types';
import type CwdApi from '../../nuclide-current-working-directory/lib/CwdApi';
import type {Store} from './types';

import createPackage from 'nuclide-commons-atom/createPackage';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
import {combineEpicsFromImports} from 'nuclide-commons/epicHelpers';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {createObservableForTunnels} from './CreateObservables';
import {getSharedHostUri, getSocketServiceByHost} from './Normalization';
import {TunnelsPanel, WORKSPACE_VIEW_URI} from './ui/TunnelsPanel';
import * as Actions from './redux/Actions';
import * as Epics from './redux/Epics';
import * as Reducers from './redux/Reducers';
import {applyMiddleware, combineReducers, createStore} from 'redux';
import {createEpicMiddleware} from 'nuclide-commons/redux-observable';

class Activation {
  _disposables: UniversalDisposable;
  _store: Store;

  constructor(rawState: ?Object) {
    this._store = createStore(
      combineReducers(Reducers),
      applyMiddleware(
        createEpicMiddleware(
          combineEpicsFromImports(Epics, 'nuclide-ssh-tunnel'),
        ),
      ),
    );

    this._disposables = new UniversalDisposable(
      this._closeAllTunnels.bind(this),
      this._registerCommandAndOpener(),
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  _registerCommandAndOpener(): UniversalDisposable {
    return new UniversalDisposable(
      atom.workspace.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return new TunnelsPanel(this._store);
        }
      }),
      () => destroyItemWhere(item => item instanceof TunnelsPanel),
      atom.commands.add(
        'atom-workspace',
        'nuclide-tunnels-panel:toggle',
        () => {
          atom.workspace.toggle(WORKSPACE_VIEW_URI);
        },
      ),
    );
  }

  provideSshTunnelService(): SshTunnelService {
    return {
      openTunnels: tunnel => createObservableForTunnels(tunnel, this._store),
      getOpenTunnels: () =>
        this._store
          .getState()
          .tunnels.toList()
          .map(t => t.tunnel)
          .toSet(),
      getAvailableServerPort: async uri =>
        getSocketServiceByHost(getSharedHostUri(uri)).getAvailableServerPort(),
    };
  }

  deserializeSshTunnelsPanel(): atom$PaneItem {
    return new TunnelsPanel(this._store);
  }

  _closeAllTunnels() {
    const tunnels = this._store.getState().tunnels;
    tunnels
      .toList()
      .forEach(active =>
        this._store.dispatch(Actions.closeTunnel(active.tunnel)),
      );
  }

  consumeCurrentWorkingDirectory(api: CwdApi): void {
    this._disposables.add(
      api.observeCwd(directory => {
        this._store.dispatch(Actions.setCurrentWorkingDirectory(directory));
      }),
    );
  }

  consumeConsole(consoleService: ConsoleService): IDisposable {
    let consoleApi = consoleService({
      id: 'Nuclide tunnels',
      name: 'Nuclide tunnels',
    });
    const disposable = new UniversalDisposable(() => {
      consoleApi != null && consoleApi.dispose();
      consoleApi = null;
    }, this._store.getState().consoleOutput.subscribe(message => consoleApi != null && consoleApi.append(message)));
    this._disposables.add(disposable);
    return disposable;
  }
}

createPackage(module.exports, Activation);
