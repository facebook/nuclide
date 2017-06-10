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

import nuclideUri from 'nuclide-commons/nuclideUri';
import React from 'react';
import {Dropdown} from '../../../nuclide-ui/Dropdown';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {ButtonGroup, ButtonGroupSizes} from 'nuclide-commons-ui/ButtonGroup';

const FB_HOST_SUFFIX = '.facebook.com';

type Props = {|
  setHost: (host: NuclideUri) => void,
  setDeviceType: (deviceType: string) => void,
  hosts: NuclideUri[],
  host: NuclideUri,
  deviceTypes: string[],
  deviceType: ?string,
|};

export class Selectors extends React.Component {
  props: Props;

  componentDidMount(): void {
    if (this.props.deviceTypes.length > 0) {
      this.props.setDeviceType(this.props.deviceTypes[0]);
    }
  }

  _getLabelForHost(host: string): string {
    if (host === '') {
      return 'local';
    }
    const hostName = nuclideUri.getHostname(host);
    return hostName.endsWith(FB_HOST_SUFFIX)
      ? hostName.substring(0, hostName.length - FB_HOST_SUFFIX.length)
      : hostName;
  }

  _getHostOptions(): Array<{value: ?string, label: string}> {
    return this.props.hosts.map(host => {
      return {value: host, label: this._getLabelForHost(host)};
    });
  }

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
          onClick={() => this.props.setDeviceType(deviceType)}>
          {deviceType}
        </Button>
      );
    });
  }

  _getTypesSelector(): React.Element<any> {
    return (
      <ButtonGroup size={ButtonGroupSizes.SMALL}>
        {this._getTypesButtons()}
      </ButtonGroup>
    );
  }

  render(): React.Element<any> {
    return (
      <div>
        <div className="nuclide-device-panel-host-selector">
          <Dropdown
            options={this._getHostOptions()}
            onChange={this.props.setHost}
            value={this.props.host}
            key="connection"
          />
        </div>
        {this._getTypesSelector()}
      </div>
    );
  }
}
