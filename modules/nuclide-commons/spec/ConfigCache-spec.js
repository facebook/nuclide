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

import {ConfigCache} from 'nuclide-commons/ConfigCache';
import nuclideUri from 'nuclide-commons/nuclideUri';

const CONFIG_FILE_NAME = '.test_nuclide_config_file';

describe('ConfigCache', () => {
  const noConfigFolder = nuclideUri.join(__dirname, 'fixtures');
  const rootFolder = nuclideUri.join(__dirname, 'fixtures/ConfigCache');
  const rootFile = nuclideUri.join(__dirname, 'fixtures/ConfigCache/file');
  const nestedFolder = nuclideUri.join(
    __dirname,
    'fixtures/ConfigCache/testFolder',
  );
  const nestedFile = nuclideUri.join(
    __dirname,
    'fixtures/ConfigCache/testFolder/file',
  );

  it('ConfigCache', () => {
    waitsForPromise(async () => {
      const cache = new ConfigCache(CONFIG_FILE_NAME);

      expect(await cache.getConfigDir(noConfigFolder)).toBe(null);
      expect(await cache.getConfigDir(rootFolder)).toBe(rootFolder);
      expect(await cache.getConfigDir(rootFile)).toBe(rootFolder);
      expect(await cache.getConfigDir(nestedFolder)).toBe(rootFolder);
      expect(await cache.getConfigDir(nestedFile)).toBe(rootFolder);
    });
  });
});
