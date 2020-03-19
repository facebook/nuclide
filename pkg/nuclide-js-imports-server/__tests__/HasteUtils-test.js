/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import nullthrows from 'nullthrows';
import {getHasteName} from '../src/lib/HasteUtils';
import {parseFile} from '../src/lib/AutoImportsManager';

describe('getHasteName', () => {
  it('returns null for non-haste files', () => {
    const ast = nullthrows(parseFile('export function f() {}'));
    expect(
      getHasteName('/test.js', ast, {
        isHaste: true,
        useNameReducers: false,
        nameReducers: [],
        nameReducerWhitelist: [],
        nameReducerBlacklist: [],
      }),
    ).toBe(null);
  });

  it('special-cases mocks', () => {
    const ast = nullthrows(parseFile('/* @providesModule asdfasdf */'));
    expect(
      getHasteName('/__mocks__/test.mock.js', ast, {
        isHaste: true,
        useNameReducers: false,
        nameReducers: [],
        nameReducerWhitelist: [],
        nameReducerBlacklist: [],
      }),
    ).toBe('test');
  });

  it('detects @providesModule', () => {
    const ast = nullthrows(
      parseFile('/* @providesModule test1234\nblah */ export function f() {}'),
    );
    expect(
      getHasteName('/test.js', ast, {
        isHaste: true,
        useNameReducers: false,
        nameReducers: [],
        nameReducerWhitelist: [],
        nameReducerBlacklist: [],
      }),
    ).toBe('test1234');
  });

  it('uses name reducers', () => {
    const ast = nullthrows(parseFile('export function f() {}'));
    const providesModuleAst = nullthrows(
      parseFile('/* @providesModule test1234\nblah */ export function f() {}'),
    );
    const hasteSettings = {
      isHaste: true,
      useNameReducers: true,
      nameReducers: [
        // basename
        {regexp: /^.*\/([a-zA-Z0-9$_.-]+\.js(\.flow)?)$/, replacement: '$1'},
        // strip .js or .js.flow suffix
        {regexp: /^(.*)\.js(\.flow)?$/, replacement: '$1'},
      ],
      nameReducerWhitelist: [/\/a\/.*/],
      nameReducerBlacklist: [/\/a\/b\/.*/],
    };
    expect(getHasteName('/a/test.js', ast, hasteSettings)).toBe('test');
    expect(getHasteName('/a/test2.js.flow', ast, hasteSettings)).toBe('test2');
    expect(getHasteName('/a/b/test.js', ast, hasteSettings)).toBe(null);
    expect(getHasteName('/b/test.js', ast, hasteSettings)).toBe(null);

    // Falls back to @providesModule, even when blacklisted.
    expect(getHasteName('/b/test.js', providesModuleAst, hasteSettings)).toBe(
      'test1234',
    );

    // No whitelist = everything
    expect(
      getHasteName('/c/test.js', ast, {
        ...hasteSettings,
        nameReducerWhitelist: [],
      }),
    ).toBe('test');

    // Test default reducer
    expect(
      getHasteName('/a/test.js', ast, {...hasteSettings, nameReducers: []}),
    ).toBe('test');
  });
});
