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

import type {Device, Task} from 'nuclide-debugger-common/types';
import type {Expected} from 'nuclide-commons/expected';

import * as React from 'react';
import {Table} from 'nuclide-commons-ui/Table';
import {DeviceTaskButton} from './DeviceTaskButton';
import {LoadingSpinner} from 'nuclide-commons-ui/LoadingSpinner';

type Props = {|
  setDevice: (?Device) => void,
  devices: Expected<Device[]>,
  deviceTasks: Map<string, Array<Task>>,
|};

export class DeviceTable extends React.Component<Props> {
  render(): React.Node {
    const devices = this.props.devices.getOrDefault([]);
    const anyTasks = Array.from(this.props.deviceTasks.values()).some(
      t => t.length > 0,
    );

    const rows = devices.map(device => {
      const tasks = this.props.deviceTasks.get(device.identifier) || [];
      return {
        data: {
          name: device.displayName,
          actions:
            tasks.length === 0 ? null : (
              <DeviceTaskButton
                tasks={tasks}
                icon="device-mobile"
                title="Device actions"
              />
            ),
        },
      };
    });
    const columns = anyTasks
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
        emptyComponent={this._getEmptyComponent()}
        selectable={true}
        onSelect={this._handleDeviceTableSelection}
        onWillSelect={this._handleDeviceWillSelect}
        rows={rows}
      />
    );
  }

  // Passes down identical stateless components so === for them works as expected
  _getEmptyComponent(): () => React.Element<any> {
    if (this.props.devices.isError) {
      return this._getErrorComponent(this.props.devices.error.message);
    } else if (this.props.devices.isPending) {
      return this._pendingComponent;
    } else {
      return this._noDevicesComponent;
    }
  }

  _pendingComponent = (): React.Element<any> => {
    return (
      <div className="padded">
        <LoadingSpinner size="EXTRA_SMALL" />
      </div>
    );
  };

  _noDevicesComponent = (): React.Element<any> => {
    return <div className="padded">No devices connected</div>;
  };

  _lastErrorMessage: string;
  _lastErrorComponent: () => React.Element<any>;
  _getErrorComponent(message: string): () => React.Element<any> {
    if (this._lastErrorMessage !== message) {
      this._lastErrorMessage = message;
      this._lastErrorComponent = () => (
        <div className="padded nuclide-device-panel-device-list-error">
          {message}
        </div>
      );
    }
    return this._lastErrorComponent;
  }

  _handleDeviceWillSelect = (
    item: any,
    selectedIndex: number,
    event: Event | SyntheticEvent<*>,
  ): boolean => {
    if (event != null) {
      let element = ((event.target: any): HTMLElement);
      while (element != null) {
        if (
          element.classList.contains(
            'nuclide-device-panel-device-action-button',
          )
        ) {
          return false;
        }
        element = element.parentElement;
      }
    }
    if (
      this.props.devices.isValue &&
      this.props.devices.value[selectedIndex].ignoresSelection
    ) {
      return false;
    }
    return true;
  };

  _handleDeviceTableSelection = (
    item: any,
    selectedDeviceIndex: number,
  ): void => {
    if (this.props.devices.isValue) {
      this.props.setDevice(this.props.devices.value[selectedDeviceIndex]);
    }
  };
}
