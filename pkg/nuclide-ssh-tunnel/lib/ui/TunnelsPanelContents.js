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

import type {ResolvedTunnel, Tunnel} from 'nuclide-adb/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ActiveTunnel} from '../types';
import passesGK from 'nuclide-commons/passesGK';

import * as React from 'react';
import ManualTunnelSection from './ManualTunnelSection';
import {TunnelsPanelTable} from './TunnelsPanelTable';
import {List} from 'immutable';

export type Props = {
  tunnels: List<ActiveTunnel>,
  closeTunnel: ResolvedTunnel => void,
  workingDirectory: ?NuclideUri,
  openTunnel(tunnel: Tunnel): void,
};

type State = {
  allowManualTunnels: boolean,
};

export class TunnelsPanelContents extends React.Component<Props, State> {
  constructor() {
    super();
    this.state = {allowManualTunnels: false};
    passesGK('nuclide_allow_manual_tunnels').then(result => {
      this.setState({allowManualTunnels: result});
    });
  }

  render(): React.Element<any> {
    return (
      <div className="nuclide-ssh-tunnels-panel-contents">
        <TunnelsPanelTable
          tunnels={this.props.tunnels}
          closeTunnel={this.props.closeTunnel}
        />
        {this.state.allowManualTunnels && (
          <ManualTunnelSection
            workingDirectory={this.props.workingDirectory}
            openTunnel={this.props.openTunnel}
          />
        )}
      </div>
    );
  }
}
