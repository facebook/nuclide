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
  toolbarJewel: string,
  updateToolbarJewel: (value: string) => void,
  cpuPercentage: number,
  memory: number,
  heapPercentage: number,
  activeHandles: number,
  activeRequests: number,
  activeHandlesByType: HandlesByType,
};

import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';

export default class BasicStatsSectionComponent extends React.Component<Props> {
  updateToolbarJewel(value: string): void {
    this.props.updateToolbarJewel(value);
  }

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
    ];

    const updateToolbarJewel = this.updateToolbarJewel;
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
            let jewelLabel = 'Show';
            let jewelValue = stat.name;
            if (this.props.toolbarJewel === stat.name) {
              props.className = 'selected';
              jewelLabel = 'Hide';
              jewelValue = 'None';
            }
            return (
              <tr {...props} key={s}>
                <th>{stat.name}</th>
                <td>{stat.value}</td>
                <td className="text-right">
                  <Button
                    size={ButtonSizes.EXTRA_SMALL}
                    onClick={updateToolbarJewel.bind(this, jewelValue)}>
                    {jewelLabel}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
}
