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

import {parseSimulatorsFromSimctlOutput} from '..';

describe('IosSimulator', () => {
  it('parses typical output', () => {
    expect(
      parseSimulatorsFromSimctlOutput(
        [
          '== Devices ==',
          '-- iOS 8.1 --',
          '    iPhone 4s (4FE43B33-EF13-49A5-B6A6-658D32F20988) (Booted)',
          '-- iOS 8.4 --',
          '    iPhone 4s (EAB622C7-8ADE-4FAE-A911-94C0CA4709BB) (Shutdown)',
          '    iPhone 5 (AE1CD3D0-A85B-4A73-B320-9CA7BA4FAEB0) (Shutdown)',
        ].join('\n'),
      ),
    ).toEqual([
      {
        name: 'iPhone 4s',
        udid: '4FE43B33-EF13-49A5-B6A6-658D32F20988',
        os: '8.1',
        state: 'BOOTED',
        arch: 'i386',
      },
      {
        name: 'iPhone 4s',
        udid: 'EAB622C7-8ADE-4FAE-A911-94C0CA4709BB',
        os: '8.4',
        state: 'SHUT_DOWN',
        arch: 'i386',
      },
      {
        name: 'iPhone 5',
        udid: 'AE1CD3D0-A85B-4A73-B320-9CA7BA4FAEB0',
        os: '8.4',
        state: 'SHUT_DOWN',
        arch: 'i386',
      },
    ]);
  });

  it('ignores unavailable simulators', () => {
    expect(
      parseSimulatorsFromSimctlOutput(
        [
          '== Devices ==',
          '-- iOS 8.1 --',
          '    iPhone 4s (4FE43B33-EF13-49A5-B6A6-658D32F20988) (Shutdown)',
          '-- Unavailable: com.apple.CoreSimulator.SimRuntime.iOS-8-3 --',
          '    iPhone 5s (EAB622C7-8ADE-4FAE-A911-94C0CA4709BB) (Shutdown)',
        ].join('\n'),
      ),
    ).toEqual([
      {
        name: 'iPhone 4s',
        udid: '4FE43B33-EF13-49A5-B6A6-658D32F20988',
        os: '8.1',
        state: 'SHUT_DOWN',
        arch: 'i386',
      },
    ]);
  });

  it('ignores garbage', () => {
    expect(
      parseSimulatorsFromSimctlOutput('Something went terribly wrong (-42)'),
    ).toEqual([]);
  });
});
