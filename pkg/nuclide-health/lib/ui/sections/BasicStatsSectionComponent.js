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

import type {HandlesByType} from '../../types';

import * as React from 'react';

type Props = {
  cpuPercentage: number,
  memory: number,
  heapPercentage: number,
  activeHandles: number,
  activeRequests: number,
  activeHandlesByType: HandlesByType,
  attachedDomNodes: ?number,
  domNodes: ?number,
  domListeners: ?number,
};

export default class BasicStatsSectionComponent extends React.Component<Props> {
  render(): React.Node {
    const stats = [
      {
        name: 'CPU',
        value: `${this.props.cpuPercentage.toFixed(0)}%`,
      },
      {
        name: 'Heap',
        value: `${this.props.heapPercentage.toFixed(1)}%`,
      },
      {
        name: 'Memory',
        value: `${Math.floor(this.props.memory / 1024 / 1024)}MB`,
      },
      {
        name: 'Handles',
        value: `${this.props.activeHandles}`,
      },
      {
        name: 'Child processes',
        value: `${this.props.activeHandlesByType.childprocess.length}`,
      },
      {
        name: 'Event loop',
        value: `${this.props.activeRequests}`,
      },
      {
        name: 'Attached DOM Nodes',
        value: `${
          this.props.attachedDomNodes != null
            ? this.props.attachedDomNodes
            : 'N/A - are your devtools open?'
        }`,
      },
      {
        name: 'Retained DOM Nodes',
        value: `${
          this.props.domNodes != null
            ? this.props.domNodes
            : 'N/A - are your devtools open?'
        }`,
      },
      {
        name: 'DOM Listeners',
        value: `${
          this.props.domListeners != null
            ? this.props.domListeners
            : 'N/A - are your devtools open?'
        }`,
      },
    ];
    return (
      <table className="table">
        <thead>
          <tr>
            <th width="30%">Metric</th>
            <th width="50%">Value</th>
            <th width="20%" className="text-right">
              Toolbar
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.map((stat, s) => {
            const props: Object = {};
            return (
              <tr {...props} key={s}>
                <th>{stat.name}</th>
                <td>{stat.value}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
}
