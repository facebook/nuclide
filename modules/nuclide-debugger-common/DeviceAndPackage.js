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

import {getAdbServiceByNuclideUri} from 'nuclide-adb';
import {Dropdown} from 'nuclide-commons-ui/Dropdown';
import {LoadingSpinner} from 'nuclide-commons-ui/LoadingSpinner';
import {Expect} from 'nuclide-commons/expected';
import * as React from 'react';
import {AdbDeviceSelector} from './AdbDeviceSelector';

type Props = {|
  +targetUri: NuclideUri,
  +onSelect: (deviceSerial: ?string, javaPackage: string) => void,
  +deserialize: () => ?string,
|};

type State = {
  selectedDeviceSerial: ?string,
  launchPackage: string,
  packages: Expected<Array<string>>,
};

export class DeviceAndPackage extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      selectedDeviceSerial: null,
      launchPackage: '',
      packages: Expect.value([]),
    };
  }

  async _refreshPackageList(device: ?AdbDevice) {
    if (device != null) {
      const packages = Expect.value(
        (await getAdbServiceByNuclideUri(
          this.props.targetUri,
        ).getInstalledPackages(device.serial)).sort(),
      );
      this.setState({
        packages,
      });
    } else {
      this.setState({
        packages: Expect.value([]),
      });
    }
  }

  setState(partialState: Object, callback?: () => mixed): void {
    const fullState: State = {
      ...this.state,
      ...partialState,
    };
    super.setState(fullState, () => {
      this.props.onSelect(
        fullState.selectedDeviceSerial,
        fullState.launchPackage,
      );
      callback && callback();
    });
  }

  _handleDeviceChange = (device: ?AdbDevice): void => {
    const state: $Shape<State> = {
      selectedDeviceSerial: device?.serial,
      packages: device == null ? Expect.value([]) : Expect.pending(),
    };
    const value = this.props.deserialize();
    if (
      device != null &&
      (this.state.selectedDeviceSerial == null ||
        device.serial !== this.state.selectedDeviceSerial) &&
      value != null
    ) {
      state.launchPackage = value;
    }

    this.setState(state, () => {
      this._refreshPackageList(device);
    });
  };

  render(): React.Node {
    return (
      <div className="block">
        <label>Device:</label>
        <AdbDeviceSelector
          onChange={this._handleDeviceChange}
          targetUri={this.props.targetUri}
        />
        <label>Package: </label>
        {this.state.packages.isPending ? (
          <LoadingSpinner size="EXTRA_SMALL" />
        ) : (
          <Dropdown
            disabled={this.state.selectedDeviceSerial == null}
            options={this.state.packages.getOrDefault([]).map(packageName => {
              return {value: packageName, label: packageName};
            })}
            onChange={value => this.setState({launchPackage: value})}
            value={this.state.launchPackage}
          />
        )}
      </div>
    );
  }
}
