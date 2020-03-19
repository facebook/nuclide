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
import temp from 'temp';
import DiskCache from '../DiskCache';

temp.track();

describe('DiskCache', () => {
  let tempFile;
  beforeEach(() => {
    tempFile = temp.openSync();
  });

  it('is able to save and load values from disk', async () => {
    const cache: DiskCache<number, number> = new DiskCache(
      tempFile.path,
      key => `k${key}`,
    );
    expect(await cache.load()).toBe(false);
    expect(cache.getPath()).toBe(tempFile.path);
    expect(cache.getByteSize()).toBe(0);
    expect(cache.get(1)).toBe(undefined);
    cache.set(1, 2);
    cache.set(3, 4);
    expect(cache.get(1)).toBe(2);
    expect(cache.get(3)).toBe(4);
    expect(await cache.save()).toBe(true);
    expect(cache.getByteSize()).toBe(15);

    const restore = new DiskCache(tempFile.path, key => `k${key}`);
    expect(await restore.load()).toBe(true);
    expect(restore.getByteSize()).toBe(15);
    expect(restore.get(1)).toBe(2);
    expect(restore.get(3)).toBe(4);
  });

  it('does not leak Object methods', async () => {
    const cache = new DiskCache(tempFile.path, x => x);
    expect(cache.get('hasOwnProperty')).toBe(undefined);
    expect(await cache.save()).toBe(true);
    expect(await cache.load()).toBe(true);
    expect(cache.get('hasOwnProperty')).toBe(undefined);
  });
});
