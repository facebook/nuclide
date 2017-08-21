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

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {
  DevicePanelWorkspaceView,
  WORKSPACE_VIEW_URI,
} from './DevicePanelWorkspaceView';
import {Disposable} from 'atom';
import invariant from 'invariant';
import {ServerConnection} from '../../nuclide-remote-connection/lib/ServerConnection';
import {
  combineEpics,
  createEpicMiddleware,
} from 'nuclide-commons/redux-observable';
import {applyMiddleware, createStore} from 'redux';
import {createEmptyAppState} from './redux/createEmptyAppState';
import * as Reducers from './redux/Reducers';
import * as Actions from './redux/Actions';
import * as Epics from './redux/Epics';
import {getProviders} from './providers';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';

import type {Store, DevicePanelServiceApi} from './types';

let activation = null;

class Activation {
  _disposables: UniversalDisposable;
  _store: Store;

  constructor(state: ?Object) {
    const epics = Object.keys(Epics)
      .map(k => Epics[k])
      .filter(epic => typeof epic === 'function');
    this._store = createStore(
      Reducers.app,
      createEmptyAppState(),
      applyMiddleware(createEpicMiddleware(combineEpics(...epics))),
    );
    this._disposables = new UniversalDisposable(
      ServerConnection.observeRemoteConnections().subscribe(conns => {
        const hosts = conns.map(conn => conn.getUriOfRemotePath('/'));
        this._store.dispatch(Actions.setHosts([''].concat(hosts)));
      }),
      this._registerCommandAndOpener(),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  _registerCommandAndOpener(): UniversalDisposable {
    return new UniversalDisposable(
      atom.workspace.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return new DevicePanelWorkspaceView(this._store);
        }
      }),
      () => destroyItemWhere(item => item instanceof DevicePanelWorkspaceView),
      atom.commands.add('atom-workspace', 'nuclide-device-panel:toggle', () => {
        atom.workspace.toggle(WORKSPACE_VIEW_URI);
      }),
    );
  }

  deserializeDevicePanelState(): DevicePanelWorkspaceView {
    return new DevicePanelWorkspaceView(this._store);
  }

  _refreshDeviceTypes(): void {
    this._store.dispatch(
      Actions.setDeviceTypes(
        Array.from(getProviders().deviceList).map(p => p.getType()),
      ),
    );
  }

  _createProviderRegistration<T>(
    providers: Set<T>,
    onDispose?: () => void,
  ): (provider: T) => Disposable {
    return (provider: T) => {
      invariant(
        activation != null,
        'Device panel service API used after deactivation',
      );
      providers.add(provider);
      if (onDispose != null) {
        onDispose();
      }
      return new Disposable(() => {
        if (activation != null) {
          providers.delete(provider);
        }
      });
    };
  }

  provideDevicePanelServiceApi(): DevicePanelServiceApi {
    activation = this;
    this._disposables.add(() => {
      activation = null;
    });
    const providers = getProviders();
    return {
      registerListProvider: this._createProviderRegistration(
        providers.deviceList,
        () => this._refreshDeviceTypes(),
      ),
      registerInfoProvider: this._createProviderRegistration(
        providers.deviceInfo,
      ),
      registerProcessesProvider: this._createProviderRegistration(
        providers.deviceProcesses,
      ),
      registerTaskProvider: this._createProviderRegistration(
        providers.deviceTask,
      ),
      registerProcessTaskProvider: this._createProviderRegistration(
        providers.processTask,
      ),
      registerDeviceTypeTaskProvider: this._createProviderRegistration(
        providers.deviceTypeTask,
      ),
      registerDeviceActionProvider: this._createProviderRegistration(
        providers.deviceAction,
      ),
    };
  }
}

createPackage(module.exports, Activation);
