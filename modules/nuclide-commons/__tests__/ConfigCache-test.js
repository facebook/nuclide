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
import {ConfigCache} from '../ConfigCache';
import nuclideUri from '../nuclideUri';

const CONFIG_FILE_NAME = '.test_nuclide_config_file';
const CONFIG_FILE_NAME_2 = '.test_nuclide_config_file_2';

describe('ConfigCache', () => {
  const noConfigFolder = nuclideUri.join(__dirname, '../__mocks__/fixtures');
  const rootFolder = nuclideUri.join(
    __dirname,
    '../__mocks__/fixtures/ConfigCache',
  );
  const rootFile = nuclideUri.join(
    __dirname,
    '../__mocks__/fixtures/ConfigCache/file',
  );
  const nestedFolder = nuclideUri.join(
    __dirname,
    '../__mocks__/fixtures/ConfigCache/testFolder',
  );
  const nestedFolder2 = nuclideUri.join(
    __dirname,
    '../__mocks__/fixtures/ConfigCache/testFolder2',
  );

  it('finds the right config dir', async () => {
    const cache = new ConfigCache([CONFIG_FILE_NAME]);

    expect(await cache.getConfigDir(noConfigFolder)).toBe(null);
    expect(await cache.getConfigDir(rootFolder)).toBe(rootFolder);
    expect(await cache.getConfigDir(rootFile)).toBe(rootFolder);
  });

  it('prefers closer matches with multiple config files', async () => {
    const cache = new ConfigCache([CONFIG_FILE_NAME, CONFIG_FILE_NAME_2]);

    expect(await cache.getConfigDir(rootFolder)).toBe(rootFolder);
    expect(await cache.getConfigDir(nestedFolder2)).toBe(nestedFolder2);
  });

  it('prefers further matches when the search strategy is "eclipse"', async () => {
    const cache = new ConfigCache(
      [CONFIG_FILE_NAME, CONFIG_FILE_NAME_2],
      'eclipse',
    );

    expect(await cache.getConfigDir(rootFolder)).toBe(rootFolder);
    expect(await cache.getConfigDir(nestedFolder)).toBe(rootFolder);
    expect(await cache.getConfigDir(nestedFolder2)).toBe(rootFolder);
  });

  it('prefers priority matches when the search strategy is "ocaml"', async () => {
    const cache = new ConfigCache(
      [CONFIG_FILE_NAME, CONFIG_FILE_NAME_2],
      'ocaml',
    );

    expect(await cache.getConfigDir(rootFolder)).toBe('/');
    expect(await cache.getConfigDir(nestedFolder2)).toBe('/');
  });

  it('matches only when both files are in the directory when the search strategy is "aurora"', async () => {
    const cache = new ConfigCache(
      [CONFIG_FILE_NAME, CONFIG_FILE_NAME_2],
      'aurora',
    );
    expect(await cache.getConfigDir(nestedFolder)).toBe(nestedFolder);
    expect(await cache.getConfigDir(nestedFolder2)).toBe(null);
    expect(await cache.getConfigDir(rootFolder)).toBe(null);
  });

  it('matches first path segment when the search strategy is "thrift"', async () => {
    const cache = new ConfigCache(
      ['ConfigCache/testFolder', 'ConfigCache'],
      'thrift',
    );

    // matches both patterns, tie-breaks with first one
    expect(await cache.getConfigDir(nestedFolder)).toBe(nestedFolder);
    // matches second pattern
    expect(await cache.getConfigDir(nestedFolder2)).toBe(rootFolder);
  });
});
