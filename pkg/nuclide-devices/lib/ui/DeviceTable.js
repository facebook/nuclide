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

import type {Device} from '../types';
import type {Expected} from '../../../nuclide-expected';

import React from 'react';
import {Table} from 'nuclide-commons-ui/Table';

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
    (this: any)._handleDeviceTableSelection = this._handleDeviceTableSelection.bind(
      this,
    );
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

  render(): React.Element<any> {
    const devices = this.props.devices.getOrDefault([]);

    const rows = devices.map(_device => ({
      data: {name: _device.displayName},
    }));
    const columns = [
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
        rows={rows}
      />
    );
  }

  _handleDeviceTableSelection(item: any, selectedDeviceIndex: number): void {
    if (!this.props.devices.isError) {
      this.props.setDevice(this.props.devices.value[selectedDeviceIndex]);
    }
  }
}
