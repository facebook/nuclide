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

import type {Device, DeviceAction, DeviceActionProvider} from '../types';
import type {Expected} from '../../../commons-node/expected';

import React from 'react';
import {Table} from 'nuclide-commons-ui/Table';
import {getProviders} from '../providers';
import {DeviceTaskButton} from './DeviceTaskButton';

type Props = {|
  setDevice: (?Device) => void,
  devices: Expected<Device[]>,
  device: ?Device,
|};

export class DeviceTable extends React.Component {
  props: Props;
  _emptyComponent: () => React.Element<any>;

  constructor(props: Props) {
    super(props);
    this._emptyComponent = () => {
      if (this.props.devices.isError) {
        return (
          <div className="padded nuclide-device-panel-device-list-error">
            {this.props.devices.error.message}
          </div>
        );
      }
      return <div className="padded">No devices connected</div>;
    };
  }

  _getActionsForDevice(
    device: Device,
    actionProviders: Set<DeviceActionProvider>,
  ): Array<DeviceAction> {
    const actions = [];
    for (const provider of actionProviders) {
      const deviceActions = provider.getActionsForDevice(device);
      if (deviceActions.length > 0) {
        actions.push(...deviceActions);
      }
    }
    return actions;
  }

  render(): React.Element<any> {
    const devices = this.props.devices.getOrDefault([]);

    const actionProviders = getProviders().deviceAction;
    const anyActions =
      devices.length > 0 &&
      devices.find(
        device => this._getActionsForDevice(device, actionProviders).length > 0,
      ) != null;
    const rows = devices.map(_device => {
      const actions = this._getActionsForDevice(_device, actionProviders);
      return {
        data: {
          name: _device.displayName,
          actions:
            actions.length === 0
              ? null
              : <DeviceTaskButton
                  actions={actions}
                  device={_device}
                  icon="device-mobile"
                  title="Device actions"
                />,
        },
      };
    });
    const columns = anyActions
      ? [
          {
            key: 'name',
            title: 'Devices',
            width: 0.7,
          },
          {
            key: 'actions',
            title: 'Actions',
            width: 0.3,
          },
        ]
      : [
          {
            key: 'name',
            title: 'Devices',
            width: 1.0,
          },
        ];

    return (
      <Table
        collapsable={false}
        columns={columns}
        fixedHeader={true}
        maxBodyHeight="99999px"
        emptyComponent={this._emptyComponent}
        selectable={true}
        onSelect={this._handleDeviceTableSelection}
        onWillSelect={this._handleDeviceWillSelect}
        rows={rows}
      />
    );
  }

  _handleDeviceWillSelect = (
    item: any,
    selectedIndex: number,
    event: SyntheticMouseEvent,
  ): boolean => {
    let element = ((event.target: any): HTMLElement);
    while (element != null) {
      if (
        element.classList.contains('nuclide-device-panel-device-action-button')
      ) {
        return false;
      }
      element = element.parentElement;
    }
    return true;
  };

  _handleDeviceTableSelection = (
    item: any,
    selectedDeviceIndex: number,
  ): void => {
    if (!this.props.devices.isError) {
      this.props.setDevice(this.props.devices.value[selectedDeviceIndex]);
    }
  };
}
