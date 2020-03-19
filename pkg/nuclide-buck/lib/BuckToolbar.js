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

import type {
  AppState,
  DeploymentTarget,
  DeviceGroup,
  MobilePlatform,
  PlatformGroup,
  TaskSettings,
  UnsanitizedTaskSettings,
} from './types';
import type {Option} from 'nuclide-commons-ui/Dropdown';

import * as React from 'react';
import shallowequal from 'shallowequal';

import {formatDeploymentTarget} from './DeploymentTarget';
import BuckToolbarSettings from './ui/BuckToolbarSettings';
import BuckToolbarTargetSelector from './ui/BuckToolbarTargetSelector';
import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import {Dropdown} from 'nuclide-commons-ui/Dropdown';
import {LoadingSpinner} from 'nuclide-commons-ui/LoadingSpinner';
import addTooltip from 'nuclide-commons-ui/addTooltip';
import invariant from 'assert';

type Props = {
  appState: AppState,
  setBuildTarget(buildTarget: string): void,
  setDeploymentTarget(deploymentTarget: DeploymentTarget): void,
  setTaskSettings(
    settings: TaskSettings,
    unsanitizedSettings: UnsanitizedTaskSettings,
  ): void,
};

type State = {
  settingsVisible: boolean,
};

type DropdownGroup = {
  header: Option,
  selectableOptions: Array<Option>,
};

function hasMultipleOptions(platformGroups: Array<PlatformGroup>): boolean {
  if (platformGroups.length === 0) {
    return false;
  }
  const multipleGroups = platformGroups.length > 1;
  const multiplePlatforms = platformGroups[0].platforms.length > 1;
  const mobilePlatform = platformGroups[0].platforms[0].isMobile;
  return multipleGroups || multiplePlatforms || mobilePlatform;
}

export default class BuckToolbar extends React.Component<Props, State> {
  state = {settingsVisible: false};

  render(): React.Node {
    const {
      buildRuleType,
      buildTarget,
      buckRoot,
      buckversionFileContents,
      isLoadingRule,
      isLoadingPlatforms,
      platformGroups,
      platformProviderUi,
      selectedDeploymentTarget,
      taskSettings,
      unsanitizedTaskSettings,
    } = this.props.appState;
    invariant(buckRoot != null);
    const extraToolbarUi =
      platformProviderUi != null ? platformProviderUi.toolbar : null;
    const extraSettings =
      platformProviderUi != null ? platformProviderUi.settings : null;

    let status;
    if (isLoadingRule || isLoadingPlatforms) {
      const title = isLoadingRule
        ? 'Loading target build rule...'
        : 'Loading available platforms...';
      status = (
        <div
          // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
          ref={addTooltip({title, delay: 0})}>
          <LoadingSpinner
            className="inline-block buck-spinner"
            size="EXTRA_SMALL"
          />
        </div>
      );
    } else if (buildTarget && buildRuleType == null) {
      status = (
        <span
          className="icon icon-alert"
          // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
          ref={addTooltip({
            title:
              `'${buildTarget}' could not be found in ${buckRoot}.<br />` +
              'Check your Current Working Root or click to retry',
            delay: 0,
          })}
          onClick={() => this.props.setBuildTarget(buildTarget)}
        />
      );
    }

    const widgets = [];
    if (status != null) {
      widgets.push(
        <div
          key="status"
          className="nuclide-buck-status inline-block text-center">
          {status}
        </div>,
      );
    } else if (hasMultipleOptions(platformGroups)) {
      const options = this._optionsFromPlatformGroups(platformGroups);

      widgets.push(
        <Dropdown
          key="simulator-dropdown"
          className="inline-block"
          value={selectedDeploymentTarget}
          options={options}
          onChange={this._handleDeploymentTargetChange}
          size="sm"
          title="Choose a device"
          selectionComparator={shallowequal}
        />,
      );

      if (extraToolbarUi) {
        widgets.push(extraToolbarUi);
      }
    }

    return (
      <div className="nuclide-buck-toolbar inline-block">
        <BuckToolbarTargetSelector
          appState={this.props.appState}
          setBuildTarget={this.props.setBuildTarget}
        />
        <Button
          className="nuclide-buck-settings icon icon-gear"
          size={ButtonSizes.SMALL}
          onClick={() => this._showSettings()}
        />
        {widgets}
        {this.state.settingsVisible ? (
          <BuckToolbarSettings
            buckRoot={buckRoot}
            buckversionFileContents={buckversionFileContents}
            settings={taskSettings}
            unsanitizedSettings={unsanitizedTaskSettings}
            platformProviderSettings={extraSettings}
            onDismiss={() => this._hideSettings()}
            onSave={(settings, unsanitizedSettings) =>
              this._saveSettings(settings, unsanitizedSettings)
            }
          />
        ) : null}
      </div>
    );
  }

  _handleDeploymentTargetChange = (deploymentTarget: DeploymentTarget) => {
    this.props.setDeploymentTarget(deploymentTarget);
  };

  _showSettings() {
    this.setState({settingsVisible: true});
  }

  _hideSettings() {
    this.setState({settingsVisible: false});
  }

  _saveSettings(
    settings: TaskSettings,
    unsanitizedSettings: UnsanitizedTaskSettings,
  ) {
    this.props.setTaskSettings(settings, unsanitizedSettings);
    this._hideSettings();
  }

  _optionsFromPlatformGroups(
    platformGroups: Array<PlatformGroup>,
  ): Array<Option> {
    return platformGroups.reduce((options, platformGroup) => {
      let dropdownGroup = null;
      if (platformGroup.platforms.length === 1) {
        const platform = platformGroup.platforms[0];
        if (!platform.isMobile) {
          // Header = platform group name, options = platform names
          // We don't have any device for non-mobile platforms
          dropdownGroup = this._topLevelOptionsArePlatforms(platformGroup);
        } else if (platform.deviceGroups.length === 1) {
          // Header = platform group name + platform name, options = device names
          // No submenus, just a list of devices at the top level
          dropdownGroup = this._topLevelOptionsAreDevices(
            platformGroup,
            platform,
            platform.deviceGroups[0],
          );
        } else if (platform.deviceGroups.length > 1) {
          // Header = platform group name + platform name, options = device group names
          // Options are submenus containing device names
          dropdownGroup = this._topLevelOptionsAreDeviceGroups(
            platformGroup,
            platform,
          );
        } else {
          // Header = platform group name, option = platform name
          // This one looks weird, but it's rare and we need to be able to select something
          dropdownGroup = this._topLevelOptionsArePlatforms(platformGroup);
        }
      } else {
        // Header = platform group name, options = platform names
        // If platforms have device groups, they become submenus with device groups inside
        // If platforms have no device groups, they are simple selectable options
        dropdownGroup = this._topLevelOptionsArePlatforms(platformGroup);
      }

      options.push(dropdownGroup.header);
      return options.concat(dropdownGroup.selectableOptions);
    }, []);
  }

  _topLevelOptionsAreDevices(
    platformGroup: PlatformGroup,
    platform: MobilePlatform,
    deviceGroup: DeviceGroup,
  ): DropdownGroup {
    const header = {
      label: formatDeploymentTarget({
        platformGroup,
        platform,
        deviceGroup,
        device: null,
      }),
      value: platform.name,
      disabled: true,
    };

    const selectableOptions = deviceGroup.devices.map(device => {
      const value = {platformGroup, platform, deviceGroup, device};
      return {
        label: `  ${device.name}`,
        selectedLabel: formatDeploymentTarget(value),
        value,
      };
    });

    return {header, selectableOptions};
  }

  _topLevelOptionsAreDeviceGroups(
    platformGroup: PlatformGroup,
    platform: MobilePlatform,
  ): DropdownGroup {
    const header = {
      label: formatDeploymentTarget({
        platformGroup,
        platform,
        deviceGroup: null,
        device: null,
      }),
      value: platform.name,
      disabled: true,
    };
    const selectableOptions = [];

    for (const deviceGroup of platform.deviceGroups) {
      if (deviceGroup.name !== '') {
        const submenu = [];
        for (const device of deviceGroup.devices) {
          const value = {platformGroup, platform, deviceGroup, device};
          submenu.push({
            label: `  ${device.name}`,
            selectedLabel: formatDeploymentTarget(value),
            value,
          });
        }

        selectableOptions.push({
          type: 'submenu',
          label: `  ${deviceGroup.name}`,
          submenu,
        });
      } else {
        for (const device of deviceGroup.devices) {
          const value = {platformGroup, platform, deviceGroup, device};
          selectableOptions.push({
            label: `  ${device.name}`,
            selectedLabel: formatDeploymentTarget(value),
            value,
          });
        }
      }
    }

    return {header, selectableOptions};
  }

  _topLevelOptionsArePlatforms(platformGroup: PlatformGroup): DropdownGroup {
    const header = {
      label: platformGroup.name,
      value: platformGroup.name,
      disabled: true,
    };
    const selectableOptions = [];

    for (const platform of platformGroup.platforms) {
      if (platform.isMobile && platform.deviceGroups.length) {
        const submenu = [];

        for (const deviceGroup of platform.deviceGroups) {
          if (deviceGroup.name !== '') {
            submenu.push({
              label: deviceGroup.name,
              value: deviceGroup.name,
              disabled: true,
            });
          }

          for (const device of deviceGroup.devices) {
            const value = {platformGroup, platform, deviceGroup, device};
            submenu.push({
              label: `  ${device.name}`,
              selectedLabel: formatDeploymentTarget(value),
              value,
            });
          }

          if (deviceGroup.name === '') {
            submenu.push({type: 'separator'});
          }
        }

        selectableOptions.push({
          type: 'submenu',
          label: `  ${platform.name}`,
          submenu,
        });
      } else {
        const value = {
          platformGroup,
          platform,
          deviceGroup: null,
          device: null,
        };
        selectableOptions.push({
          label: `  ${platform.name}`,
          selectedLabel: formatDeploymentTarget(value),
          value,
        });
      }
    }

    return {header, selectableOptions};
  }
}
