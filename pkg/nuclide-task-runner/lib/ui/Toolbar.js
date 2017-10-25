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

import type {TaskRunner, TaskMetadata, TaskRunnerState} from '../types';
import type {Option} from '../../../nuclide-ui/Dropdown';

import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {TaskRunnerButton} from './TaskRunnerButton';
import {Dropdown} from '../../../nuclide-ui/Dropdown';
import FullWidthProgressBar from '../../../nuclide-ui/FullWidthProgressBar';
import classnames from 'classnames';
import * as React from 'react';
import invariant from 'assert';

type Props = {
  toolbarDisabled: boolean,
  taskRunners: Array<TaskRunner>,
  statesForTaskRunners: Map<TaskRunner, TaskRunnerState>,
  activeTaskRunner: ?TaskRunner,
  iconComponent: ?React.ComponentType<any>,
  extraUiComponent: ?React.ComponentType<any>,
  progress: ?number,
  runTask: (taskMeta: TaskMetadata & {taskRunner: TaskRunner}) => void,
  selectTaskRunner: (taskRunner: TaskRunner) => void,
  stopRunningTask: () => void,
  taskIsRunning: boolean,
  runningTaskIsCancelable: boolean | void,
};

export class Toolbar extends React.Component<Props> {
  render(): React.Node {
    const className = classnames('nuclide-task-runner-toolbar', {
      disabled: this.props.toolbarDisabled,
    });

    const {activeTaskRunner, taskRunners} = this.props;
    let taskRunnerOptions = [];
    let taskRunnerSpecificContent = null;
    let dropdownVisibility = {visibility: 'hidden'};
    if (taskRunners.length === 0 && !this.props.toolbarDisabled) {
      dropdownVisibility = {display: 'none'};
      taskRunnerSpecificContent = <NoTaskRunnersMessage />;
    } else if (activeTaskRunner) {
      const taskRunnerState = this.props.statesForTaskRunners.get(
        activeTaskRunner,
      );
      if (taskRunnerState) {
        taskRunnerOptions = getTaskRunnerOptions(
          taskRunners,
          this.props.statesForTaskRunners,
        );
        const ExtraUi = this.props.extraUiComponent;
        const extraUi = ExtraUi ? <ExtraUi key="extraui" /> : null;
        const taskButtons = this._renderTaskButtons();
        taskRunnerSpecificContent = [taskButtons, extraUi];
        dropdownVisibility = {};
      }
    }

    const ButtonComponent = buttonProps => (
      <TaskRunnerButton
        {...buttonProps}
        disabled={this.props.taskIsRunning}
        iconComponent={this.props.iconComponent}
      />
    );

    return (
      <div className={`${className} padded`}>
        <div className="nuclide-task-runner-toolbar-contents">
          <span className="inline-block" style={dropdownVisibility}>
            <Dropdown
              buttonComponent={ButtonComponent}
              value={activeTaskRunner}
              options={taskRunnerOptions}
              onChange={value => {
                this.props.selectTaskRunner(value);
              }}
              size="sm"
            />
          </span>
          {taskRunnerSpecificContent}
        </div>
        <FullWidthProgressBar
          progress={this.props.progress}
          visible={this.props.taskIsRunning}
        />
      </div>
    );
  }

  _renderTaskButtons(): ?React.Element<any> {
    const taskButtons = this._getButtonsForTasks();
    return (
      <span className="inline-block" key="taskButtons">
        <ButtonGroup>
          {taskButtons}
          <Button
            className="nuclide-task-button"
            key="stop"
            size={ButtonSizes.SMALL}
            icon="primitive-square"
            tooltip={tooltip('Stop')}
            disabled={this.props.runningTaskIsCancelable !== true}
            onClick={this.props.stopRunningTask}
          />
        </ButtonGroup>
      </span>
    );
  }

  _getButtonsForTasks(): Array<?React.Element<any>> {
    const {activeTaskRunner} = this.props;
    invariant(activeTaskRunner);
    const state = this.props.statesForTaskRunners.get(activeTaskRunner);
    if (!state) {
      return [];
    }
    invariant(state);
    return state.tasks.filter(task => task.hidden !== true).map(task => {
      return (
        <Button
          className="nuclide-task-button"
          key={task.type}
          size={ButtonSizes.SMALL}
          icon={task.icon}
          tooltip={tooltip(task.label)}
          disabled={
            task.disabled || this.props.runningTaskIsCancelable === false
          }
          onClick={() =>
            this.props.runTask({...task, taskRunner: activeTaskRunner})}
        />
      );
    });
  }
}

function tooltip(title: string): atom$TooltipsAddOptions {
  return {title, delay: {show: 500, hide: 0}, placement: 'bottom'};
}

function getTaskRunnerOptions(
  taskRunners: Array<TaskRunner>,
  statesForTaskRunners: Map<TaskRunner, TaskRunnerState>,
): Array<Option> {
  return taskRunners.map(runner => {
    const state = statesForTaskRunners.get(runner);
    return {
      value: runner,
      label: runner.name,
      disabled: !state || !state.enabled,
      selectedLabel: '',
    };
  });
}

function NoTaskRunnersMessage(): ?React.Element<any> {
  const featureLink = 'https://nuclide.io/docs/features/task-runner/';
  return (
    <span style={{'white-space': 'nowrap'}}>
      Install and enable a <a href={featureLink}>task runner</a> to use this
      toolbar
    </span>
  );
}
