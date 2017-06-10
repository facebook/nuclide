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

import {
  getWindowLoadSettings,
  setWindowLoadSettings,
} from '../window-load-settings';

describe('getWindowLoadSettings', () => {
  it('should get the window load settings', () => {
    const keys = Object.keys(getWindowLoadSettings());
    expect(keys).toContain('initialPaths');
    expect(keys).toContain('resourcePath');
    expect(keys).toContain('env');
  });
});

describe('setWindowLoadSettings', () => {
  it('should change the window load settings', () => {
    const loadSettings = getWindowLoadSettings();
    setWindowLoadSettings({...loadSettings, test: 'test1234'});
    expect(getWindowLoadSettings().test).toBe('test1234');
  });
});
