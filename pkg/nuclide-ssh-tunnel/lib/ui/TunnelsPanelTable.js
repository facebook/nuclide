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
import type {OpenTunnel, Tunnel} from '../types';

import TunnelCloseButton from './TunnelCloseButton';
import {Table} from 'nuclide-commons-ui/Table';
import React from 'react';

type Props = {
  tunnels: Array<[Tunnel, OpenTunnel]>,
  closeTunnel: (tunnel: Tunnel) => void,
};

export class TunnelsPanelTable extends React.Component {
  props: Props;

  render(): React.Element<any> {
    const columns = [
      {
        title: 'From',
        key: 'from',
      },
      {
        title: 'To',
        key: 'to',
      },
      {
        title: 'Status',
        key: 'status',
      },
      {
        title: '',
        key: 'close',
        width: 0,
      },
    ];
    const rows = this.props.tunnels.map(([tunnel, openTunnel]) => {
      let {host} = tunnel.from;
      const ignoredEnding = '.facebook.com';
      if (host.endsWith(ignoredEnding)) {
        host = host.slice(0, host.length - ignoredEnding.length);
      }
      return {
        className: 'nuclide-ssh-tunnels-table-row',
        data: {
          from: `${host}:${tunnel.from.port}`,
          to: `${tunnel.to.host}:${tunnel.to.port}`,
          status: openTunnel.state,
          close: (
            <TunnelCloseButton
              tunnel={tunnel}
              closeTunnel={this.props.closeTunnel}
            />
          ),
        },
      };
    });
    return (
      <Table
        emptyComponent={() =>
          <div className="nuclide-ssh-tunnels-table-empty-message">
            No SSH tunnels are open.
          </div>}
        className="nuclide-ssh-tunnels-table"
        rows={rows}
        columns={columns}
        selectable={true}
      />
    );
  }
}
