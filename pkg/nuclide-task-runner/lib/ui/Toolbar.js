'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {AnnotatedTaskMetadata, TaskId, TaskRunnerInfo} from '../types';

import {Button, ButtonSizes} from '../../../nuclide-ui/Button';
import {CommonControls} from './CommonControls';
import {ProgressBar} from './ProgressBar';
import {getTaskMetadata} from '../getTaskMetadata';
import classnames from 'classnames';
import {React} from 'react-for-atom';

type Props = {
  disabled: boolean,
  taskRunnerInfo: Array<TaskRunnerInfo>,
  getActiveTaskRunnerIcon: () => ?ReactClass<any>,
  getExtraUi: ?() => ReactClass<any>,
  progress: ?number,
  runTask: (taskId?: TaskId) => void,
  activeTaskId: ?TaskId,
  selectTask: (taskId: TaskId) => void,
  stopTask: () => void,
  showPlaceholder: boolean,
  taskIsRunning: boolean,
  taskLists: Map<string, Array<AnnotatedTaskMetadata>>,
};

export class Toolbar extends React.Component {
  props: Props;

  _renderExtraUi(): ?React.Element<any> {
    if (this.props.activeTaskId) {
      const ExtraUi = this.props.getExtraUi && this.props.getExtraUi();
      return ExtraUi ? <ExtraUi activeTaskType={this.props.activeTaskId.type} /> : null;
    }
    const runnerCount = this.props.taskRunnerInfo.length;
    if (runnerCount === 0) {
      return <span>Please install and enable a task runner</span>;
    } else {
      const waitingForTasks = !Array.from(this.props.taskLists.values())
        .some(taskList => taskList.length > 0);
      if (waitingForTasks) {
        if (runnerCount === 1) {
          const runnerName = this.props.taskRunnerInfo[0].name;
          return <span>Waiting for tasks from {runnerName}...</span>;
        }
        return <span>Waiting for tasks from {runnerCount} task runners...</span>;
      }
      return <span>No Task Selected</span>;
    }
  }

  _renderContents(activeTask: ?AnnotatedTaskMetadata): React.Element<any> {
    if (this.props.showPlaceholder) {
      return <Placeholder />;
    }

    return (
      <div style={{display: 'flex', flex: 1}}>
        <CommonControls
          activeTask={activeTask}
          getActiveTaskRunnerIcon={this.props.getActiveTaskRunnerIcon}
          taskRunnerInfo={this.props.taskRunnerInfo}
          runTask={this.props.runTask}
          selectTask={this.props.selectTask}
          taskIsRunning={this.props.taskIsRunning}
          taskLists={this.props.taskLists}
          stopTask={this.props.stopTask}
        />
        {this._renderExtraUi()}
        <ProgressBar
          progress={this.props.progress}
          visible={this.props.taskIsRunning}
        />
      </div>
    );
  }

  render(): ?React.Element<any> {
    const activeTaskId = this.props.activeTaskId;
    const activeTask = activeTaskId == null
      ? null
      : getTaskMetadata(activeTaskId, this.props.taskLists);

    const className = classnames('nuclide-task-runner-toolbar', {
      disabled: this.props.disabled,
    });

    return (
      <div className={className}>
        <div className="nuclide-task-runner-toolbar-contents padded">
          {this._renderContents(activeTask)}
        </div>
      </div>
    );
  }

}

function Placeholder(): React.Element<any> {
  return (
    // Themes actually change the size of UI elements (sometimes even dynamically!) and can
    // therefore change the size of the toolbar! To try to ensure that the placholder has the same
    // height as the toolbar, we put a dummy button in it and hide it with CSS.
    <Button
      className="nuclide-task-runner-placeholder"
      size={ButtonSizes.SMALL}>
      Seeing this button is a bug!
    </Button>
  );
}
