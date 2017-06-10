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

import type {ChildProcessInfo} from '../../types';

import React from 'react';
import HandlesTableComponent from './HandlesTableComponent';

type Props = {
  childProcessesTree: ?ChildProcessInfo,
};

type ProcessWithLevel = {
  process: ChildProcessInfo,
  level: number,
};

export default class ChildProcessTreeComponent extends React.Component {
  props: Props;

  render(): React.Element<any> {
    const {childProcessesTree} = this.props;
    if (!childProcessesTree) {
      return <div />;
    }

    const handles = [];
    flatten(handles, childProcessesTree, 0);

    return (
      <div>
        <HandlesTableComponent
          title="Process tree"
          handles={handles}
          keyed={({process, level}) => '\u00A0'.repeat(level * 3) + process.pid}
          columns={[
            {
              title: 'CPU %',
              value: ({process, level}) => process.cpuPercentage,
              widthPercentage: 5,
            },
            {
              title: 'In',
              value: ({process}) =>
                process.ioBytesStats && process.ioBytesStats.stdin,
              widthPercentage: 3,
            },
            {
              title: 'Out',
              value: ({process}) =>
                process.ioBytesStats && process.ioBytesStats.stdout,
              widthPercentage: 3,
            },
            {
              title: 'Err',
              value: ({process}) =>
                process.ioBytesStats && process.ioBytesStats.stderr,
              widthPercentage: 3,
            },
            {
              title: 'Command',
              value: ({process, level}) => process.command,
              widthPercentage: 56,
            },
          ]}
        />
      </div>
    );
  }
}

function flatten(
  handles: Array<ProcessWithLevel>,
  process: ChildProcessInfo,
  level: number,
): void {
  handles.push({process, level});
  process.children.forEach(child => flatten(handles, child, level + 1));
}
