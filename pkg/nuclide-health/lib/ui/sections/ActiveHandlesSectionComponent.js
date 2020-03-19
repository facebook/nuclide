/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {HandlesByType} from '../../types';

import * as React from 'react';
import HandlesTableComponent from './HandlesTableComponent';

type Props = {
  activeHandlesByType: HandlesByType,
};

export default class ActiveHandlesSectionComponent extends React.Component<
  Props,
> {
  render(): React.Node {
    if (
      !this.props.activeHandlesByType ||
      Object.keys(this.props.activeHandlesByType).length === 0
    ) {
      return <div />;
    }

    // Note that widthPercentage properties should add up to 90 since the ID column always adds 10.
    return (
      <div>
        <HandlesTableComponent
          key={2}
          title="TLS Sockets"
          handles={this.props.activeHandlesByType.tlssocket}
          keyed={socket => socket.localPort}
          columns={[
            {
              title: 'Host',
              value: socket => socket._host || socket.remoteAddress,
              widthPercentage: 70,
            },
            {
              title: 'Read',
              value: socket => socket.bytesRead,
              widthPercentage: 10,
            },
            {
              title: 'Written',
              value: socket => socket.bytesWritten,
              widthPercentage: 10,
            },
          ]}
        />
        <HandlesTableComponent
          key={3}
          title="Other handles"
          handles={this.props.activeHandlesByType.other}
          keyed={(handle, h) => h}
          columns={[
            {
              title: 'Type',
              value: handle => handle.constructor.name,
              widthPercentage: 90,
            },
          ]}
        />
      </div>
    );
  }
}
