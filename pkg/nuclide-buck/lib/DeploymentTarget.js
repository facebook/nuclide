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
  Device,
  DeviceGroup,
  Platform,
  PlatformGroup,
  PlatformProviderUi,
} from './types';

import invariant from 'assert';

type PreferredNames = {
  platformGroupName: ?string,
  platformName: ?string,
  deviceGroupName: ?string,
  deviceName: ?string,
};

export function getDeploymentTargetPreference(state: AppState): PreferredNames {
  const target = state.selectedDeploymentTarget;
  // If a deployment target exists, that's our first choice, otherwise look at the last session
  if (target != null) {
    return {
      platformGroupName: target.platformGroup.name,
      platformName: target.platform.name,
      deviceGroupName: target.deviceGroup ? target.deviceGroup.name : null,
      deviceName: target.device ? target.device.name : null,
    };
  } else {
    return {
      platformGroupName: state.lastSessionPlatformGroupName,
      platformName: state.lastSessionPlatformName,
      deviceGroupName: state.lastSessionDeviceGroupName,
      deviceName: state.lastSessionDeviceName,
    };
  }
}

export function selectValidDeploymentTarget(
  preferred: PreferredNames,
  platformGroups: Array<PlatformGroup>,
): ?DeploymentTarget {
  if (platformGroups.length === 0) {
    return null;
  }

  let result;
  result = getPreferred(platformGroups, preferred.platformGroupName, false);
  const platformGroup = result.value;
  invariant(platformGroup);
  result = getPreferred(
    platformGroup.platforms,
    preferred.platformName,
    result.skipRest,
  );
  const platform = result.value;
  invariant(platform);
  result = platform.isMobile
    ? getPreferred(
        platform.deviceGroups,
        preferred.deviceGroupName,
        result.skipRest,
      )
    : null;
  const deviceGroup = result != null ? result.value : null;
  result =
    result != null && deviceGroup != null
      ? getPreferred(deviceGroup.devices, preferred.deviceName, result.skipRest)
      : null;
  const device = result && result.value;

  return {
    platformGroup,
    platform,
    deviceGroup,
    device,
  };
}

function getPreferred<T: PlatformGroup | Platform | DeviceGroup | Device>(
  groups: Array<T>,
  name: ?string,
  chooseFirst: boolean,
): {value: ?T, skipRest: boolean} {
  if (groups.length === 0) {
    return {value: null, skipRest: true};
  }
  let match;
  // We want === in case of an empty string
  // eslint-disable-next-line eqeqeq
  if (name === null || chooseFirst) {
    match = null;
  } else {
    match = groups.find(group => group.name === name);
  }
  let skipRest;
  if (match == null) {
    match = groups[0];
    skipRest = true;
  } else {
    skipRest = false;
  }
  return {value: match, skipRest};
}

export function getPlatformProviderUiForDeploymentTarget(
  deploymentTarget: ?DeploymentTarget,
): ?PlatformProviderUi {
  if (
    deploymentTarget == null ||
    !deploymentTarget.platform.isMobile ||
    deploymentTarget.platform.extraUiWhenSelected == null
  ) {
    return null;
  }
  return deploymentTarget.platform.extraUiWhenSelected(deploymentTarget.device);
}
