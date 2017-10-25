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

import type {Process, ProcessTask, ProcessTaskType} from '../types';
import type {IconName} from 'nuclide-commons-ui/Icon';

import {Dropdown} from '../../../nuclide-ui/Dropdown';
import * as React from 'react';
import {Icon} from 'nuclide-commons-ui/Icon';

type Props = {|
  tasks: ProcessTask[],
  proc: Process,
  icon: IconName,
  taskType: ProcessTaskType,
  className?: string,
  nameIfManyTasks: string,
|};

export class ProcessTaskButton extends React.Component<Props> {
  _getTaskOptions(): {value: ProcessTask, label: string}[] {
    return this.props.tasks
      .filter(
        task =>
          task.type === this.props.taskType &&
          task.isSupported(this.props.proc),
      )
      .map(task => ({value: task, label: task.name}));
  }

  render(): React.Node {
    const options = this._getTaskOptions();
    if (options.length === 0) {
      return <div />;
    } else if (options.length === 1) {
      return (
        <span onClick={() => options[0].value.run(this.props.proc)}>
          <Icon
            icon={this.props.icon}
            title={options[0].label}
            className={this.props.className}
          />
        </span>
      );
    } else {
      const placeholder: any = (
        <Icon icon={this.props.icon} title={this.props.nameIfManyTasks} />
      );
      return (
        // $FlowFixMe(>=0.53.0) Flow suppress
        <Dropdown
          isFlat={true}
          options={options}
          placeholder={placeholder}
          size="xs"
          onChange={(task: ProcessTask) =>
            task != null && task.run(this.props.proc)}
        />
      );
    }
  }
}
