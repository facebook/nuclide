/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */

import invariant from 'assert';
import {remote, ipcRenderer} from 'electron';
invariant(remote != null && ipcRenderer != null);
import nuclideConfig from '../nuclide-config';
import * as nuclideConfigFunctions from '../nuclide-config';

const currentWindowId = remote.getCurrentWindow().id;
const mockSettings = {test: 'mockSettings'};
const testKey = 'test-nuclide-config-key';
const testOptions = {scope: []};
const testValue = 'test-nuclide-config-value';
const UPDATE_NUCLIDE_CONFIG_SETTINGS = 'nuclide-config-update-settings';
const mockConfigUpdateSettings = {
  settings: mockSettings,
  options: testOptions,
};

let ipcRendererSendSpy;
let resetUserSettingsSpy;
let setSpy;
let unsetSpy;

beforeEach(() => {
  setSpy = jest
    .spyOn(nuclideConfig._config, 'set')
    .mockImplementation(() => true);
  unsetSpy = jest
    .spyOn(nuclideConfig._config, 'unset')
    .mockImplementation(() => {});
  ipcRendererSendSpy = jest.spyOn(ipcRenderer, 'send');
  resetUserSettingsSpy = jest
    .spyOn(nuclideConfig._config, 'resetUserSettings')
    .mockImplementation(() => {});

  // Patch the setting so we can test that they are sent/received and reset
  nuclideConfig._config.settings = mockSettings;
});

describe('nuclide-config', () => {
  afterEach(() => {
    // Clear mock calls between tests
    ipcRendererSendSpy.mockClear();
    resetUserSettingsSpy.mockClear();
  });

  it('updates the nuclide config settings on set and emits the updated settings', () => {
    nuclideConfig.set(testKey, testValue, testOptions);
    expect(setSpy).toHaveBeenCalledWith(testKey, testValue, testOptions);
    expect(ipcRendererSendSpy).toHaveBeenCalledWith(
      UPDATE_NUCLIDE_CONFIG_SETTINGS,
      {settings: mockSettings, options: testOptions},
    );
  });

  it('updates the nuclide config settings on unset and emits the updated settings', () => {
    nuclideConfig.unset(testKey, testOptions);
    expect(unsetSpy).toHaveBeenCalledWith(testKey, testOptions);
    expect(ipcRendererSendSpy).toHaveBeenCalledWith(
      UPDATE_NUCLIDE_CONFIG_SETTINGS,
      {settings: mockSettings, options: testOptions},
    );
  });

  describe('__updateConfigSettingsListener', () => {
    it('resets the config settings on change emitted from another process', () => {
      const differentWindowId = currentWindowId + 1;
      const mockEvent = {
        sender: {
          getOwnerBrowserWindow: () => ({
            id: differentWindowId,
          }),
        },
        returnValue: {},
      };
      nuclideConfigFunctions.__updateConfigSettingsListener(
        (mockEvent: any),
        mockConfigUpdateSettings,
      );
      expect(resetUserSettingsSpy).toHaveBeenCalledWith(
        mockSettings,
        testOptions,
      );
    });

    it('does not reset the config settings on change emitted from own process', () => {
      const mockEvent = {
        sender: {
          getOwnerBrowserWindow: () => ({
            id: currentWindowId,
          }),
        },
        returnValue: {},
      };
      nuclideConfigFunctions.__updateConfigSettingsListener(
        (mockEvent: any),
        mockConfigUpdateSettings,
      );
      expect(resetUserSettingsSpy).not.toHaveBeenCalled();
    });
  });
});
