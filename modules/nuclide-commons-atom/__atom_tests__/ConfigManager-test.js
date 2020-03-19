/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import ConfigManager from '../ConfigManager';

const Config = atom.config.constructor;
const testConfig = new Config({mainSource: 'testFilePath'});
const configManager = new ConfigManager(testConfig);

describe('ConfigManager', () => {
  it('manages only the passed-in config', () => {
    // Set atom.config value for testing
    atom.config.set('testValue', true);
    expect(configManager.get('testValue')).toBeUndefined();
    configManager.set('testValue', false);
    expect(testConfig.get('testValue')).toBe(false);
    expect(configManager.get('testValue')).toBe(false);
    expect(atom.config.get('testValue')).toBe(true);
  });

  it('returns numbers when numbers are set', () => {
    configManager.set('foobar', 5);
    expect(configManager.get('foobar')).toEqual(5);
  });

  it('returns booleans when numbers are set', () => {
    configManager.set('cat', true);
    expect(configManager.get('cat')).toEqual(true);
  });

  it('passes values to observers on change', () => {
    const spy = jest.fn();
    configManager.observe('animal', spy);
    configManager.set('animal', 'yup');
    expect(spy).toHaveBeenCalled();
  });

  it('can observeAsStream', () => {
    const spy = jest.fn();
    configManager.observeAsStream('animal').subscribe(spy);
    configManager.set('animal', 'yup');
    expect(spy).toHaveBeenCalled();
  });

  it('passes options to observe', () => {
    const spy = jest.fn();
    configManager.observe('animal', {scope: []}, spy);
    configManager.set('animal', 'yup');
    expect(spy).toHaveBeenCalled();
  });

  it('calls callbacks passed to `onDidChange`', () => {
    const spy = jest.fn();
    configManager.onDidChange('mars.attacks', spy);
    configManager.set('mars.attacks', 42);
    expect(spy).toHaveBeenCalled();
  });

  it('resets to defaults with "unset"', () => {
    configManager.setSchema('purple.pants', {type: 'number', default: 15});
    configManager.set('purple.pants', 25);
    expect(configManager.get('purple.pants')).toEqual(25);
    configManager.unset('purple.pants');
    expect(configManager.get('purple.pants')).toEqual(15);
  });
});
