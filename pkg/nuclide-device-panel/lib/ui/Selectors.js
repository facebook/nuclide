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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Option} from 'nuclide-commons-ui/Dropdown';
import type {DeviceTypeComponent} from 'nuclide-debugger-common/types';

import * as React from 'react';
import * as Immutable from 'immutable';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Dropdown} from 'nuclide-commons-ui/Dropdown';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {ButtonGroup, ButtonGroupSizes} from 'nuclide-commons-ui/ButtonGroup';

type Props = {|
  setHost: (host: NuclideUri) => void,
  setDeviceType: (deviceType: string) => void,
  toggleDevicePolling: (isActive: boolean) => void,
  hosts: NuclideUri[],
  host: NuclideUri,
  deviceTypes: string[],
  deviceType: ?string,
  hostSelectorComponents: Immutable.List<DeviceTypeComponent>,
|};

export class Selectors extends React.Component<Props> {
  componentDidMount(): void {
    if (this.props.deviceTypes.length > 0) {
      this._setDeviceType(this.props.deviceTypes[0]);
    }
  }

  _getLabelForHost(host: NuclideUri): string {
    return host === ''
      ? 'localhost'
      : nuclideUri.nuclideUriToDisplayHostname(host);
  }

  _getHostOptions(): Array<Option> {
    return this.props.hosts.map(host => {
      return {value: host, label: this._getLabelForHost(host)};
    });
  }

  _getHostSelectorNodes = (): Immutable.List<React.Element<any>> => {
    return this.props.hostSelectorComponents.map(component => {
      const Type = component.type;
      return <Type key={component.key} />;
    });
  };

  _getTypesButtons(): React.Element<any>[] {
    return this.props.deviceTypes.map(deviceType => {
      if (deviceType === this.props.deviceType) {
        return (
          <Button key={deviceType} buttonType={ButtonTypes.PRIMARY}>
            {deviceType}
          </Button>
        );
      }
      return (
        <Button
          key={deviceType}
          onClick={() => this._setDeviceType(deviceType)}>
          {deviceType}
        </Button>
      );
    });
  }

  _setDeviceType(deviceType: string) {
    this.props.setDeviceType(deviceType);
    this.props.toggleDevicePolling(true);
  }

  _getTypesSelector(): React.Element<any> {
    return (
      <ButtonGroup size={ButtonGroupSizes.SMALL}>
        {this._getTypesButtons()}
      </ButtonGroup>
    );
  }

  _getHostSelector(): React.Element<any> {
    return (
      <div className="nuclide-device-panel-host-selector">
        {this._getHostSelectorNodes()}
        <Dropdown
          options={this._getHostOptions()}
          onChange={host => {
            this.props.setHost(host);
            this._updateDeviceType();
          }}
          value={this.props.host}
          key="connection"
        />
      </div>
    );
  }

  _updateDeviceType(): void {
    if (this.props.deviceTypes.length > 0) {
      this._setDeviceType(
        this.props.deviceType != null
          ? this.props.deviceType
          : this.props.deviceTypes[0],
      );
    }
  }

  render(): React.Node {
    return (
      <div className="block nuclide-device-panel-navigation-row">
        {this._getTypesSelector()}
        {this._getHostSelector()}
      </div>
    );
  }
}
