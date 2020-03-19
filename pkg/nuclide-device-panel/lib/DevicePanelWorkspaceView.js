/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {Props} from './ui/RootPanel';
import type {Store, AppState} from './types';

import * as React from 'react';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import {RootPanel} from './ui/RootPanel';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import observableFromReduxStore from 'nuclide-commons/observableFromReduxStore';
import * as Actions from './redux/Actions';

export const WORKSPACE_VIEW_URI = 'atom://nuclide/devices';

export class DevicePanelWorkspaceView {
  _store: Store;

  constructor(store: Store) {
    this._store = store;
  }

  getTitle() {
    return 'Devices';
  }

  getIconName() {
    return 'device-mobile';
  }

  getPreferredWidth(): number {
    return 400;
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  getDefaultLocation(): string {
    return 'right';
  }

  _appStateToProps(state: AppState): Props {
    const toggleDevicePolling = (isActive: boolean) => {
      this._store.dispatch(Actions.toggleDevicePolling(isActive));
    };
    const toggleProcessPolling = (isActive: boolean) => {
      this._store.dispatch(Actions.toggleProcessPolling(isActive));
    };
    const setHost = host => {
      this._store.dispatch(Actions.setHost(host));
    };
    const setDeviceType = deviceType => {
      this._store.dispatch(Actions.setDeviceType(deviceType));
    };
    const setDevice = device => {
      this._store.dispatch(Actions.setDevice(device));
    };
    return {
      devices: state.devices,
      hosts: state.hosts,
      host: state.host,
      deviceTypes: state.deviceTypes,
      deviceType: state.deviceType,
      device: state.device,
      infoTables: state.infoTables,
      appInfoTables: state.appInfoTables,
      processes: state.processes,
      deviceTasks: state.deviceTasks,
      processTasks: state.processTasks,
      isDeviceConnected: state.isDeviceConnected,
      deviceTypeTasks: state.deviceTypeTasks,
      deviceTypeComponents: state.deviceTypeComponents,
      toggleDevicePolling,
      toggleProcessPolling,
      setHost,
      setDeviceType,
      setDevice,
    };
  }

  getElement(): HTMLElement {
    const PreparedDevicePanel = bindObservableAsProps(
      observableFromReduxStore(this._store)
        .distinctUntilChanged()
        .map(state => this._appStateToProps(state)),
      RootPanel,
    );

    return renderReactRoot(<PreparedDevicePanel />);
  }

  serialize(): {deserializer: string} {
    return {
      deserializer: 'nuclide.DevicePanelWorkspaceView',
    };
  }
}
