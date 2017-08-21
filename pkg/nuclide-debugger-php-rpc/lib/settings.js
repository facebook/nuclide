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

export type HhvmDebuggerSettings = {
  singleThreadStepping: boolean,
};

const defaultSettings: HhvmDebuggerSettings = {
  singleThreadStepping: true,
};

let settings: HhvmDebuggerSettings = defaultSettings;

export function getSettings(): HhvmDebuggerSettings {
  return settings;
}

export function updateSettings(newSettings: Object): void {
  for (const key in newSettings) {
    settings[key] = newSettings[key];
  }
}

export function clearSettings(): void {
  settings = defaultSettings;
}
