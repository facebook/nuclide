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

import type {Expected} from 'nuclide-commons/expected';
import type {
  Process,
  Task,
  ProcessTask,
  AppInfoRow,
} from 'nuclide-debugger-common/types';
import type {Props as TaskButtonPropsType} from './TaskButton';
import type {TaskEvent} from 'nuclide-commons/process';

import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {Icon} from 'nuclide-commons-ui/Icon';
import * as React from 'react';
import {AppInfoTable} from './AppInfoTable';
import {InfoTable} from './InfoTable';
import {ProcessTable} from './ProcessTable';
import {TaskButton} from './TaskButton';
import {LoadingSpinner} from 'nuclide-commons-ui/LoadingSpinner';

type Props = {|
  toggleProcessPolling: (isActive: boolean) => void,
  goToRootPanel: () => void,
  infoTables: Expected<Map<string, Map<string, string>>>,
  appInfoTables: Expected<Map<string, Array<AppInfoRow>>>,
  processes: Expected<Process[]>,
  processTasks: ProcessTask[],
  deviceTasks: Array<Task>,
  isDeviceConnected: boolean,
|};

export class DevicePanel extends React.Component<Props> {
  _createInfoTables(): React.Element<any>[] {
    if (this.props.infoTables.isError) {
      return [
        <div className="block" key="infoTableError">
          {
            // $FlowFixMe
            this.props.infoTables.error
          }
        </div>,
      ];
    } else if (this.props.infoTables.isPending) {
      return [<LoadingSpinner size="EXTRA_SMALL" key="infoTableLoading" />];
    } else {
      return Array.from(this.props.infoTables.value.entries()).map(
        ([title, infoTable]) => (
          <div className="block" key={title}>
            <InfoTable title={title} table={infoTable} />
          </div>
        ),
      );
    }
  }

  _createAppInfoTables(): React.Element<any>[] {
    const appInfoTables = this.props.appInfoTables;

    if (appInfoTables.isError) {
      return [
        <div className="block" key="infoTableError">
          {
            // $FlowFixMe
            appInfoTables.error
          }
        </div>,
      ];
    } else if (appInfoTables.isPending) {
      return [<LoadingSpinner size="EXTRA_SMALL" key="infoTableLoading" />];
    } else {
      return Array.from(appInfoTables.value.entries()).map(
        ([appName, appInfoRows]) => (
          <div className="block" key={appName}>
            <AppInfoTable title={appName} rows={appInfoRows} />
          </div>
        ),
      );
    }
  }

  _createProcessTable(): React.Element<any> {
    return (
      <div className="block" key="process-table">
        <ProcessTable
          processes={this.props.processes}
          processTasks={this.props.processTasks}
          toggleProcessPolling={this.props.toggleProcessPolling}
        />
      </div>
    );
  }

  _taskEventsToProps(task: Task, taskEvent: ?TaskEvent): TaskButtonPropsType {
    return {
      name: task.getName(),
      start: () => task.start(),
      cancel: () => task.cancel(),
      isRunning: taskEvent != null,
      progress: null,
    };
  }

  _getTasks(): React.Element<any> {
    const tasks = Array.from(this.props.deviceTasks).map(task => {
      const StreamedTaskButton = bindObservableAsProps(
        task
          .getTaskEvents()
          .distinctUntilChanged()
          .map(taskEvent => this._taskEventsToProps(task, taskEvent)),
        TaskButton,
      );
      return <StreamedTaskButton key={task.getName()} />;
    });
    return (
      <div className="block nuclide-device-panel-tasks-container">{tasks}</div>
    );
  }

  _getBackButton(): React.Element<any> {
    return (
      <div className="block">
        <span>
          <a
            className="nuclide-device-panel-text-with-icon"
            onClick={() => this.props.goToRootPanel()}>
            <Icon icon="chevron-left">Choose another device</Icon>
          </a>
        </span>
      </div>
    );
  }

  _getStatus(): ?React.Element<any> {
    if (this.props.isDeviceConnected) {
      return null;
    }

    return (
      <div className="block">
        <span className="nuclide-device-panel-text-with-icon nuclide-device-panel-disconnected-icon">
          <Icon icon="primitive-dot">Disconnected</Icon>
        </span>
      </div>
    );
  }

  render(): React.Node {
    return (
      <div>
        {this._getBackButton()}
        {this._getStatus()}
        {this._getTasks()}
        {this._createInfoTables()}
        {this._createAppInfoTables()}
        {this._createProcessTable()}
      </div>
    );
  }
}
