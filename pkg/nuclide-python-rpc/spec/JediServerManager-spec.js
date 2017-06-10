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

import fsPromise from 'nuclide-commons/fsPromise';
import JediServerManager from '../lib/JediServerManager';

describe('JediServerManager', () => {
  let jediServerManager;

  beforeEach(() => {
    jediServerManager = new JediServerManager();
  });

  it('caches link tree paths by file name', () => {
    waitsForPromise(async () => {
      const mockPaths = ['/a/b/c', '/c/d/e'];
      const spy = spyOn(
        jediServerManager._linkTreeManager,
        'getLinkTreePaths',
      ).andReturn(mockPaths);

      let linkTreePaths = await jediServerManager.getLinkTreePaths(
        'test/file.txt',
      );
      expect(linkTreePaths).toEqual(mockPaths);
      expect(spy).toHaveBeenCalledWith('test/file.txt');

      // Second call with the same source path should retrieve link tree paths
      // directly from cache.
      jediServerManager._linkTreeManager.getLinkTreePaths.reset();
      linkTreePaths = await jediServerManager.getLinkTreePaths('test/file.txt');
      expect(spy).not.toHaveBeenCalled();
      expect(linkTreePaths).toEqual(mockPaths);
    });
  });

  it('caches top level module paths by file name', () => {
    waitsForPromise(async () => {
      const mockPath = '/a/b/c';
      const spy = spyOn(fsPromise, 'findFurthestFile').andReturn(mockPath);

      let topLevelModulePath = await jediServerManager.getTopLevelModulePath(
        'test/file.txt',
      );
      expect(topLevelModulePath).toEqual(mockPath);
      expect(spy).toHaveBeenCalledWith('__init__.py', 'test', true);

      // Second call with the same source path should retrieve top-level module path
      // directly from cache.
      (fsPromise.findFurthestFile: any).reset();
      topLevelModulePath = await jediServerManager.getTopLevelModulePath(
        'test/file.txt',
      );
      expect(spy).not.toHaveBeenCalled();
      expect(topLevelModulePath).toEqual(mockPath);
    });
  });

  it('negatively caches top level module paths by file name', () => {
    waitsForPromise(async () => {
      // Return a promise containing null to test negative caching.
      async function nullFn(): Promise<?string> {
        return null;
      }

      const spy = spyOn(fsPromise, 'findFurthestFile').andReturn(nullFn());

      let topLevelModulePath = await jediServerManager.getTopLevelModulePath(
        'test/file.txt',
      );
      expect(topLevelModulePath).toBeNull;
      expect(spy).toHaveBeenCalledWith('__init__.py', 'test', true);

      // Second call with the same source path should retrieve top-level module path
      // directly from cache.
      (fsPromise.findFurthestFile: any).reset();
      topLevelModulePath = await jediServerManager.getTopLevelModulePath(
        'test/file.txt',
      );
      expect(spy).not.toHaveBeenCalled();
      expect(topLevelModulePath).toBeNull;
    });
  });
});
