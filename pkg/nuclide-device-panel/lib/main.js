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
import {combineEpicsFromImports} from 'nuclide-commons/epicHelpers';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {
  DevicePanelWorkspaceView,
  WORKSPACE_VIEW_URI,
} from './DevicePanelWorkspaceView';
import invariant from 'assert';
import {ServerConnection} from '../../nuclide-remote-connection/lib/ServerConnection';
import {createEpicMiddleware} from 'nuclide-commons/redux-observable';
import {applyMiddleware, createStore} from 'redux';
import {createEmptyAppState} from './redux/createEmptyAppState';
import * as Reducers from './redux/Reducers';
import * as Actions from './redux/Actions';
import * as Epics from './redux/Epics';
import {getProviders} from './providers';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';

import type {Store} from './types';
import type {DevicePanelServiceApi} from 'nuclide-debugger-common/types';

let activation = null;

class Activation {
  _disposables: UniversalDisposable;
  _store: Store;

  constructor(state: ?Object) {
    this._store = createStore(
      Reducers.app,
      createEmptyAppState(),
      applyMiddleware(
        createEpicMiddleware(
          combineEpicsFromImports(Epics, 'nuclide-device-panel'),
        ),
      ),
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
      atom.commands.add(
        'atom-workspace',
        'nuclide-devices-panel:toggle',
        () => {
          atom.workspace.toggle(WORKSPACE_VIEW_URI);
        },
      ),
    );
  }

  deserializeDevicePanelState(): DevicePanelWorkspaceView {
    return new DevicePanelWorkspaceView(this._store);
  }

  _refreshDeviceTypes(): void {
    this._store.dispatch(
      Actions.setDeviceTypes(
        Array.from(getProviders().deviceList)
          .map(p => p.getType())
          .sort((a, b) => a.localeCompare(b)),
      ),
    );
  }

  _refreshDevices(): void {
    this._store.dispatch(Actions.setDevices(this._store.getState().devices));
  }

  _createProviderRegistration<T>(
    providers: Set<T>,
    onDispose?: () => void,
  ): (provider: T) => UniversalDisposable {
    return (provider: T) => {
      invariant(
        activation != null,
        'Device panel service API used after deactivation',
      );
      providers.add(provider);
      if (onDispose != null) {
        onDispose();
      }
      return new UniversalDisposable(() => {
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
      registerDeviceTaskProvider: this._createProviderRegistration(
        providers.deviceTask,
        () => this._refreshDevices(),
      ),
      registerProcessTaskProvider: this._createProviderRegistration(
        providers.processTask,
      ),
      registerDeviceTypeTaskProvider: this._createProviderRegistration(
        providers.deviceTypeTask,
        () => this._refreshDeviceTypes(),
      ),
      registerAppInfoProvider: this._createProviderRegistration(
        providers.appInfo,
      ),
      registerDeviceTypeComponentProvider: this._createProviderRegistration(
        providers.deviceTypeComponent,
      ),
    };
  }
}

createPackage(module.exports, Activation);
