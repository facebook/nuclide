'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {AppState, TaskType, TaskSettings} from './types';

import nullthrows from 'nullthrows';
import {React} from 'react-for-atom';

import BuckToolbarSettings from './ui/BuckToolbarSettings';
import BuckToolbarTargetSelector from './ui/BuckToolbarTargetSelector';
import {Button, ButtonSizes} from '../../nuclide-ui/Button';
import {Dropdown} from '../../nuclide-ui/Dropdown';
import {LoadingSpinner} from '../../nuclide-ui/LoadingSpinner';
import addTooltip from '../../nuclide-ui/add-tooltip';

type Props = {
  activeTaskType: ?TaskType,
  appState: AppState,
  setBuildTarget(buildTarget: string): void,
  setSimulator(simulator: string): void,
  setTaskSettings(taskType: TaskType, settings: TaskSettings): void,
};

type State = {
  settingsVisible: boolean,
};

export default class BuckToolbar extends React.Component {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    (this: any)._handleSimulatorChange = this._handleSimulatorChange.bind(this);
    this.state = {settingsVisible: false};
  }

  render(): React.Element<any> {
    const {
      buildRuleType,
      buildTarget,
      buckRoot,
      devices,
      isLoadingRule,
      projectRoot,
      simulator,
      taskSettings,
    } = this.props.appState;
    const isAppleBundle = buildRuleType === 'apple_bundle';
    const isLoading = isLoadingRule || (isAppleBundle && devices == null);
    let status;
    if (isLoading) {
      status =
        <div ref={addTooltip({title: 'Waiting on rule info...', delay: 0})}>
          <LoadingSpinner
            className="inline-block"
            size="EXTRA_SMALL"
          />
        </div>;
    } else if (buildTarget && buildRuleType == null) {
      let title;
      if (buckRoot == null) {
        if (projectRoot != null) {
          title = `No Buck project found in the Current Working Root:<br />${projectRoot}`;
        } else {
          title = 'No Current Working Root.';
        }
      } else {
        title =
          `Rule "${buildTarget}" could not be found in ${buckRoot}.<br />` +
          `Check your Current Working Root: ${nullthrows(projectRoot)}`;
      }

      status =
        <span
          className="icon icon-alert"
          ref={addTooltip({title, delay: 0})}
        />;
    }

    const widgets = [];
    if (status != null) {
      widgets.push(
        <div key="status" className="nuclide-buck-status inline-block text-center">
          {status}
        </div>,
      );
    } else {
      if (isAppleBundle && !isLoading && simulator != null &&
          devices != null && devices.length > 0) {
        const options = devices.map(device => ({
          label: `${device.name} (${device.os})`,
          value: device.udid,
        }));

        widgets.push(
          <Dropdown
            key="simulator-dropdown"
            className="inline-block"
            value={simulator}
            options={options}
            onChange={this._handleSimulatorChange}
            size="sm"
            title="Choose a device"
          />,
        );
      }
    }

    const {activeTaskType} = this.props;
    return (
      <div className="nuclide-buck-toolbar">
        <BuckToolbarTargetSelector
          appState={this.props.appState}
          setBuildTarget={this.props.setBuildTarget}
        />
        <Button
          className="nuclide-buck-settings icon icon-gear"
          size={ButtonSizes.SMALL}
          disabled={activeTaskType == null || buckRoot == null}
          onClick={() => this._showSettings()}
        />
        {widgets}
        {this.state.settingsVisible && activeTaskType != null ?
          <BuckToolbarSettings
            currentBuckRoot={buckRoot}
            settings={taskSettings[activeTaskType] || {}}
            buildType={activeTaskType}
            onDismiss={() => this._hideSettings()}
            onSave={settings => this._saveSettings(activeTaskType, settings)}
          /> :
          null}
      </div>
    );
  }

  _handleSimulatorChange(deviceId: string) {
    this.props.setSimulator(deviceId);
  }

  _showSettings() {
    this.setState({settingsVisible: true});
  }

  _hideSettings() {
    this.setState({settingsVisible: false});
  }

  _saveSettings(taskType: TaskType, settings: TaskSettings) {
    this.props.setTaskSettings(taskType, settings);
    this._hideSettings();
  }

}
