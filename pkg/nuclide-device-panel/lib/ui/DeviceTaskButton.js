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

import type {Device, DeviceAction} from '../types';
import type {IconName} from 'nuclide-commons-ui/Icon';

import {Dropdown} from '../../../nuclide-ui/Dropdown';
import * as React from 'react';
import {Icon} from 'nuclide-commons-ui/Icon';

type Props = {|
  actions: DeviceAction[],
  device: Device,
  icon: IconName,
  title: string,
|};

export class DeviceTaskButton extends React.Component<Props> {
  render(): React.Node {
    const options = this.props.actions;
    if (options.length === 0) {
      return <span />;
    } else {
      const placeholder: any = (
        <Icon icon={this.props.icon} title={this.props.title} />
      );
      return (
        <div className="nuclide-device-panel-device-action-button">
          <Dropdown
            isFlat={true}
            options={options.map(option => ({
              value: option,
              label: option.name,
            }))}
            placeholder={placeholder}
            size="xs"
            onChange={(action: DeviceAction) =>
              action != null && action.callback(this.props.device)}
          />
        </div>
      );
    }
  }
}
