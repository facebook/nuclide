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

import nuclideUri from 'nuclide-commons/nuclideUri';
import {getConfigFromFlow} from '../src/getConfig';

describe('getConfig', () => {
  it('reads haste configs', () => {
    const root = nuclideUri.join(__dirname, 'fixtures', 'flowconfig_haste');
    expect(getConfigFromFlow(root)).toEqual({
      moduleDirs: [],
      hasteSettings: {
        isHaste: true,
        useNameReducers: true,
        nameReducers: [
          {regexp: /^.*\/([a-zA-Z0-9$_.-]+\.js(\.flow)?)$/, replacement: '$1'},
          {regexp: /^(.*)\.js(\.flow)?$/, replacement: '$1'},
        ],
        nameReducerWhitelist: [new RegExp(root + '/whitelist/.*')],
        nameReducerBlacklist: [
          /.*\/__tests__\/.*/,
          /.*\/__mocks__\/.*/,
          new RegExp(root + '/blacklist/.*'),
        ],
      },
    });
  });

  it('reads modules', () => {
    const root = nuclideUri.join(__dirname, 'fixtures', 'flowconfig_modules');
    expect(getConfigFromFlow(root)).toEqual({
      moduleDirs: [
        nuclideUri.join(root, 'node_modules'),
        nuclideUri.join(root, 'modules'),
      ],
      hasteSettings: {
        isHaste: false,
        useNameReducers: false,
        nameReducers: [],
        nameReducerWhitelist: [],
        nameReducerBlacklist: [],
      },
    });
  });
});
