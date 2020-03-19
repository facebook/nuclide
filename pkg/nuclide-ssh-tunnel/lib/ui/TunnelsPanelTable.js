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
import type {ResolvedTunnel} from 'nuclide-adb/lib/types';
import type {ActiveTunnel} from '../types';

import nuclideUri from 'nuclide-commons/nuclideUri';
import TunnelCloseButton from './TunnelCloseButton';
import {Table} from 'nuclide-commons-ui/Table';
import * as React from 'react';
import {List} from 'immutable';

type Props = {
  tunnels: List<ActiveTunnel>,
  closeTunnel: (tunnel: ResolvedTunnel) => void,
};

export class TunnelsPanelTable extends React.Component<Props> {
  render(): React.Node {
    const columns = [
      {
        title: 'Description',
        key: 'description',
      },
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
        minWidth: 35,
      },
    ];
    const rows = this.props.tunnels
      .map(active => {
        const {from, to} = active.tunnel;
        const descriptions = new Set(
          active.subscriptions.map(s => s.description),
        );
        return {
          className: 'nuclide-ssh-tunnels-table-row',
          data: {
            description: Array.from(descriptions).join(', '),
            from: `${nuclideUri.nuclideUriToDisplayHostname(from.host)}:${
              from.port
            }`,
            to: `${nuclideUri.nuclideUriToDisplayHostname(to.host)}:${to.port}`,
            status: active.state,
            close: (
              <TunnelCloseButton
                tunnel={active.tunnel}
                closeTunnel={this.props.closeTunnel}
              />
            ),
          },
        };
      })
      .toArray();
    return (
      <Table
        emptyComponent={() => (
          <div className="nuclide-ssh-tunnels-table-empty-message">
            No tunnels are open.
          </div>
        )}
        rows={rows}
        columns={columns}
        selectable={true}
      />
    );
  }
}
