/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import * as globals from 'globals';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getConfigFromFlow, getEslintGlobals} from '../src/Config';

describe('getConfig', () => {
  it('reads haste configs', () => {
    const root = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures',
      'flowconfig_haste',
    );
    expect(getConfigFromFlow(root)).toEqual({
      moduleDirs: [nuclideUri.join(root, 'node_modules')],
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
    const root = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures',
      'flowconfig_modules',
    );
    expect(getConfigFromFlow(root)).toEqual({
      moduleDirs: [
        nuclideUri.join(root, 'node_modules'),
        nuclideUri.join(root, 'modules'),
        nuclideUri.join(root, 'yarn_workspaces'),
        nuclideUri.join(root, 'yarn_workspaces2'),
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

describe('getEslintGlobals', () => {
  it('works on projects with .eslintrc', () => {
    const root = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures',
      'eslintrc',
    );
    expect(getEslintGlobals(root)).toEqual([
      'atom',
      'window',
      'browser',
      'chrome',
      'opr',
    ]);
  });

  it('works on projects with .eslintrc.js', () => {
    const root = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures',
      'eslintrcjs',
    );
    expect(getEslintGlobals(root)).toEqual([
      'atom',
      'window',
      'browser',
      'chrome',
      'opr',
    ]);
  });

  it('works on projects with an eslintConfig', () => {
    const root = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures',
      'eslintConfig',
    );
    expect(getEslintGlobals(root)).toEqual([
      'atom',
      'window',
      'browser',
      'chrome',
      'opr',
    ]);
  });

  it('falls back to getting all environments', () => {
    const root = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures',
      'flowconfig_modules',
    );
    const allGlobals = new Set();
    Object.values(globals).forEach((obj: any) => {
      Object.keys(obj).forEach(x => allGlobals.add(x));
    });
    const eslintGlobals = getEslintGlobals(root);
    expect(eslintGlobals).toContain('window');
    expect(eslintGlobals).toContain('document');
    expect(eslintGlobals).toEqual(Array.from(allGlobals));
  });
});
