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

import type {AdbDevice} from 'nuclide-adb/lib/types';
import type {Expected} from 'nuclide-commons/expected';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {MenuItem} from 'nuclide-commons-ui/Dropdown';

import {observeAndroidDevices} from 'nuclide-adb';
import * as React from 'react';
import {Dropdown} from 'nuclide-commons-ui/Dropdown';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Expect} from 'nuclide-commons/expected';
import {LoadingSpinner} from 'nuclide-commons-ui/LoadingSpinner';
import invariant from 'assert';

const NO_DEVICES_MSG = 'No adb devices attached!';

type Props = {
  targetUri: NuclideUri,
  onChange: (value: ?AdbDevice) => void,
};

type State = {
  deviceList: Expected<Array<AdbDevice>>,
  selectedDevice: ?AdbDevice,
};

export class AdbDeviceSelector extends React.Component<Props, State> {
  props: Props;
  state: State;
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this._disposables = new UniversalDisposable();

    (this: any)._handleDeviceListChange = this._handleDeviceListChange.bind(
      this,
    );
    (this: any)._handleDeviceDropdownChange = this._handleDeviceDropdownChange.bind(
      this,
    );

    this.state = {
      deviceList: Expect.pending(),
      selectedDevice: null,
    };
  }

  componentDidMount(): void {
    this._disposables.add(
      observeAndroidDevices(this.props.targetUri)
        .startWith(Expect.pending())
        .subscribe(deviceList => this._handleDeviceListChange(deviceList)),
    );
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  _handleDeviceListChange(deviceList: Expected<Array<AdbDevice>>): void {
    const previousDevice = this.state.selectedDevice;
    let selectedDevice =
      previousDevice == null
        ? null
        : deviceList
            .getOrDefault([])
            .find(device => device.serial === previousDevice.serial);

    if (selectedDevice == null && deviceList.isValue) {
      selectedDevice = deviceList.value[0];
    }

    this.setState({
      deviceList,
      selectedDevice,
    });
    this.props.onChange(selectedDevice);
  }

  _getDeviceItems(): Array<MenuItem> {
    invariant(this.state.deviceList.isValue);
    if (this.state.deviceList.value.length === 0) {
      return [{value: null, label: NO_DEVICES_MSG}];
    }

    return this.state.deviceList.value.map(device => ({
      value: device,
      label: device.displayName,
    }));
  }

  render(): React.Node {
    if (this.state.deviceList.isPending) {
      return <LoadingSpinner size="EXTRA_SMALL" />;
    }

    if (this.state.deviceList.isError) {
      return (
        <div className="nuclide-ui-message-error">
          {this.state.deviceList.error.toString()}
        </div>
      );
    }

    const deviceItems = this._getDeviceItems();
    return (
      <Dropdown
        options={deviceItems}
        onChange={this._handleDeviceDropdownChange}
        value={this.state.selectedDevice}
      />
    );
  }

  _handleDeviceDropdownChange(selectedDevice: ?AdbDevice): void {
    this.setState({
      selectedDevice,
    });
    this.props.onChange(selectedDevice);
  }
}
