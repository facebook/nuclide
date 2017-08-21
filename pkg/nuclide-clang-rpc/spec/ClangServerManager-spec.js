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

import invariant from 'assert';
import ClangServerManager from '../lib/ClangServerManager';

describe('ClangServerManager', () => {
  let serverManager;
  let emptyRequestSettings;
  beforeEach(() => {
    serverManager = new ClangServerManager();
    emptyRequestSettings = {compilationDatabase: null, projectRoot: null};
    spyOn(serverManager._flagsManager, 'getFlagsForSrc').andReturn(
      Promise.resolve(null),
    );
  });

  it('uses flags from manager if available', () => {
    waitsForPromise(async () => {
      serverManager._flagsManager.getFlagsForSrc.andReturn(
        Promise.resolve({flags: ['a']}),
      );
      const flagsResult = await serverManager._getFlags(
        'test.cpp',
        emptyRequestSettings,
      );
      expect(flagsResult).toEqual({flags: ['a'], usesDefaultFlags: false});
    });
  });

  it('falls back to default flags', () => {
    waitsForPromise(async () => {
      const flagsResult = await serverManager._getFlags(
        'test.cpp',
        emptyRequestSettings,
        ['b'],
      );
      expect(flagsResult).toEqual({
        flags: ['b'],
        usesDefaultFlags: true,
        flagsFile: null,
      });
    });
  });

  it('returns null when no flags are available', () => {
    waitsForPromise(async () => {
      const server = serverManager.getClangServer('test.cpp', '');
      await server.waitForReady();
      expect(server.isDisposed()).toBe(true);
    });
  });

  it('handles restartIfChanged', () => {
    waitsForPromise(async () => {
      const TEST_FILE = 'test.cpp';
      const server = serverManager.getClangServer(
        TEST_FILE,
        '',
        null,
        [],
        true,
      );
      const server2 = serverManager.getClangServer(
        TEST_FILE,
        '',
        null,
        [],
        true,
      );
      expect(server2).toBe(server);

      spyOn(server, 'getFlagsChanged').andReturn(true);
      const server3 = serverManager.getClangServer(
        TEST_FILE,
        '',
        null,
        [],
        true,
      );
      expect(server3).not.toBe(server);
    });
  });

  it('has a hard limit on server count', () => {
    waitsForPromise(async () => {
      const servers = [];
      for (let i = 0; i < 21; i++) {
        // eslint-disable-next-line no-await-in-loop
        servers.push(
          serverManager.getClangServer(`test${i}.cpp`, '', null, []),
        );
      }
      invariant(servers[0]);
      expect(servers[0].isDisposed()).toBe(true);
      invariant(servers[1]);
      expect(servers[1].isDisposed()).toBe(false);
    });
  });

  it('enforces a memory limit', () => {
    waitsForPromise(async () => {
      const server = serverManager.getClangServer('test.cpp', '', null, []);
      invariant(server);
      spyOn(server, 'getMemoryUsage').andReturn(Promise.resolve(1e99));

      // We're still over the limit, but keep the last one alive.
      const server2 = serverManager.getClangServer('test2.cpp', '', null, []);
      invariant(server2);
      spyOn(server2, 'getMemoryUsage').andReturn(Promise.resolve(1e99));

      await serverManager._checkMemoryUsage();
      expect(server.isDisposed()).toBe(true);
      expect(server2.isDisposed()).toBe(false);

      // It should be disposed once the next server gets created.
      const server3 = serverManager.getClangServer('test3.cpp', '', null, []);
      invariant(server3);
      spyOn(server3, 'getMemoryUsage').andReturn(Promise.resolve(1));

      await serverManager._checkMemoryUsage();
      expect(server2.isDisposed()).toBe(true);
      expect(server3.isDisposed()).toBe(false);
    });
  });
});
