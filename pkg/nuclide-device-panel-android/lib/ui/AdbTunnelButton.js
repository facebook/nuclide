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

import classnames from 'classnames';
import {Button} from 'nuclide-commons-ui/Button';
import nuclideUri from 'nuclide-commons/nuclideUri';
import * as React from 'react';

type Props = {
  host: NuclideUri,
  status: 'active' | 'inactive',
  enable: () => void,
  disable: () => void,
};

export function AdbTunnelButton(props: Props): React.Element<any> {
  const {host, enable, disable, status} = props;
  const className = classnames(
    'nuclide-device-panel-android-tunnel-control',
    status,
  );
  const tooltipAction =
    status === 'inactive'
      ? 'Reroute adb to know about localhost (where Atom is running) devices'
      : `Switch adb back to devices on <em>${prettify(host)}</em>`;
  return (
    <Button
      className={className}
      icon="milestone"
      tooltip={{
        title: `Tunneling (${status})<br /><br /><strong>Click:</strong> ${tooltipAction}`,
        delay: {show: 500, hide: 0},
        placement: 'bottom',
      }}
      onClick={() => {
        if (status === 'inactive') {
          enable();
        } else {
          disable();
        }
      }}
    />
  );
}

function prettify(host: NuclideUri): string {
  const FB_HOST_SUFFIX = '.facebook.com';
  const hostName = nuclideUri.getHostname(host);
  return hostName.endsWith(FB_HOST_SUFFIX)
    ? hostName.substring(0, hostName.length - FB_HOST_SUFFIX.length)
    : hostName;
}
