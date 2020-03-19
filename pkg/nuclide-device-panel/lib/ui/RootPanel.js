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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  AppInfoRow,
  ComponentPosition,
  Device,
  DeviceTypeComponent,
  Process,
  ProcessTask,
  Task,
} from 'nuclide-debugger-common/types';
import type {Expected} from 'nuclide-commons/expected';
import type {TaskEvent} from 'nuclide-commons/process';
import type {Props as TaskButtonPropsType} from './TaskButton';

import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {TaskButton} from './TaskButton';
import * as React from 'react';
import {PanelComponentScroller} from 'nuclide-commons-ui/PanelComponentScroller';
import invariant from 'assert';
import {Selectors} from './Selectors';
import {DeviceTable} from './DeviceTable';
import {DevicePanel} from './DevicePanel';
import * as Immutable from 'immutable';
import nullthrows from 'nullthrows';

export type Props = {|
  setHost: (host: NuclideUri) => void,
  setDeviceType: (deviceType: string) => void,
  setDevice: (device: ?Device) => void,
  toggleDevicePolling: (isActive: boolean) => void,
  toggleProcessPolling: (isActive: boolean) => void,
  processTasks: ProcessTask[],
  hosts: NuclideUri[],
  devices: Expected<Device[]>,
  host: NuclideUri,
  deviceTypes: string[],
  deviceType: ?string,
  deviceTasks: Map<string, Array<Task>>,
  device: ?Device,
  infoTables: Expected<Map<string, Map<string, string>>>,
  appInfoTables: Expected<Map<string, Array<AppInfoRow>>>,
  processes: Expected<Process[]>,
  isDeviceConnected: boolean,
  deviceTypeTasks: Array<Task>,
  deviceTypeComponents: Immutable.Map<
    ComponentPosition,
    Immutable.List<DeviceTypeComponent>,
  >,
|};

export class RootPanel extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
    invariant(props.hosts.length > 0);
  }

  componentDidMount(): void {
    this.props.toggleDevicePolling(true);
  }

  componentWillUnmount(): void {
    this.props.toggleDevicePolling(false);
  }

  _createDeviceTable(): ?React.Element<any> {
    // eslint-disable-next-line eqeqeq
    if (this.props.deviceType === null) {
      return null;
    }
    return (
      <DeviceTable
        devices={this.props.devices}
        setDevice={this.props.setDevice}
        deviceTasks={this.props.deviceTasks}
      />
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

  _getTasks(): ?React.Element<any> {
    const tasks = Array.from(this.props.deviceTypeTasks).map(task => {
      const StreamedTaskButton = bindObservableAsProps(
        task
          .getTaskEvents()
          .distinctUntilChanged()
          .map(taskEvent => this._taskEventsToProps(task, taskEvent)),
        TaskButton,
      );
      return <StreamedTaskButton key={task.getName()} />;
    });
    if (tasks.length < 1) {
      return null;
    }
    return (
      <div className="block nuclide-device-panel-tasks-container">{tasks}</div>
    );
  }

  _getHostSelectorComponents = (): Immutable.List<DeviceTypeComponent> => {
    return (
      this.props.deviceTypeComponents.get('host_selector') || Immutable.List()
    );
  };

  _getDeviceTypeComponents = (
    position: 'above_table' | 'below_table',
  ): ?React.Element<any> => {
    const components = this.props.deviceTypeComponents.get(position);
    if (components == null) {
      return null;
    }
    const nodes = components.map(component => {
      const Type = component.type;
      return <Type key={component.key} />;
    });

    return (
      <div className={`block nuclide-device-panel-components-${position}`}>
        {nodes}
      </div>
    );
  };

  _goToRootPanel = (): void => {
    this.props.setDevice(null);
  };

  _getInnerPanel(): React.Element<any> {
    const {device} = this.props;
    if (device != null) {
      return (
        <div className="block">
          <DevicePanel
            infoTables={this.props.infoTables}
            appInfoTables={this.props.appInfoTables}
            processes={this.props.processes}
            processTasks={this.props.processTasks}
            deviceTasks={nullthrows(
              this.props.deviceTasks.get(device.identifier),
            )}
            goToRootPanel={this._goToRootPanel}
            toggleProcessPolling={this.props.toggleProcessPolling}
            isDeviceConnected={this.props.isDeviceConnected}
          />
        </div>
      );
    }

    return (
      <div>
        <Selectors
          deviceType={this.props.deviceType}
          deviceTypes={this.props.deviceTypes}
          hosts={this.props.hosts}
          host={this.props.host}
          setDeviceType={this.props.setDeviceType}
          toggleDevicePolling={this.props.toggleDevicePolling}
          setHost={this.props.setHost}
          hostSelectorComponents={this._getHostSelectorComponents()}
        />
        {this._getDeviceTypeComponents('above_table')}
        <div className="block">{this._createDeviceTable()}</div>
        {this._getTasks()}
        {this._getDeviceTypeComponents('below_table')}
      </div>
    );
  }

  render(): React.Node {
    return (
      <PanelComponentScroller>
        <div className="nuclide-device-panel-container">
          {this._getInnerPanel()}
        </div>
      </PanelComponentScroller>
    );
  }
}
