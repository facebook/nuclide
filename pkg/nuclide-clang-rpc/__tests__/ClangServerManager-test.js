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
import invariant from 'assert';
import {Observable} from 'rxjs';
import ClangServerManager from '../lib/ClangServerManager';
import waitsFor from '../../../jest/waits_for';

describe('ClangServerManager', () => {
  let serverManager;
  let emptyRequestSettings;
  let emptyServerSettings;
  let getFlagsSpy;
  beforeEach(() => {
    serverManager = new ClangServerManager();
    emptyRequestSettings = {compilationDatabase: null, projectRoot: null};
    emptyServerSettings = {libclangPath: null, defaultFlags: []};
    getFlagsSpy = jest
      .spyOn(serverManager._flagsManager, 'getFlagsForSrc')
      .mockReturnValue(Promise.resolve(null));
  });

  afterEach(() => {
    serverManager.dispose();
  });

  it('uses flags from manager if available', async () => {
    serverManager._flagsManager.getFlagsForSrc.mockReturnValue(
      Promise.resolve({flags: ['a']}),
    );
    const flagsResult = await serverManager._getFlags(
      'test.cpp',
      emptyRequestSettings,
      emptyServerSettings,
    );
    expect(flagsResult).toEqual({flags: ['a'], usesDefaultFlags: false});
  });

  it('falls back to default flags with null database', async () => {
    const serverSettings = {defaultFlags: ['b'], libclangPath: null};
    const flagsResult = await serverManager._getFlags(
      'test.cpp',
      emptyRequestSettings,
      serverSettings,
    );
    expect(flagsResult).toEqual({
      flags: ['b'],
      usesDefaultFlags: true,
      flagsFile: null,
    });
  });

  it('falls back to default flags with only flags file without flags', async () => {
    const serverSettings = {defaultFlags: ['b'], libclangPath: null};
    // sometimes providers give us a flags file (e.g. TARGETS) without flags.
    getFlagsSpy.mockImplementation(() =>
      Promise.resolve({flags: [], directory: '.', flagsFile: 'TARGET'}),
    );
    const flagsResult = await serverManager._getFlags(
      'test.cpp',
      emptyRequestSettings,
      serverSettings,
    );
    expect(flagsResult).toEqual({
      flags: ['b'],
      usesDefaultFlags: true,
      flagsFile: 'TARGET',
    });
  });

  it('returns null when no flags are available', async () => {
    const server = serverManager.getClangServer('test.cpp', '');
    await server.waitForReady();
    expect(server.isDisposed()).toBe(true);
  });

  it('handles restartIfChanged', async () => {
    const TEST_FILE = 'test.cpp';
    const server = serverManager.getClangServer(
      TEST_FILE,
      '',
      null,
      emptyServerSettings,
      true,
    );
    const server2 = serverManager.getClangServer(
      TEST_FILE,
      '',
      null,
      emptyServerSettings,
      true,
    );
    expect(server2).toBe(server);

    jest.spyOn(server, 'getFlagsChanged').mockReturnValue(true);
    const server3 = serverManager.getClangServer(
      TEST_FILE,
      '',
      null,
      emptyServerSettings,
      true,
    );
    expect(server3).not.toBe(server);
  });

  it('has a hard limit on server count', async () => {
    const servers = [];
    // ClangServerManager.SERVER_LIMIT + 1 = 21
    for (let i = 0; i < 21; i++) {
      // eslint-disable-next-line no-await-in-loop
      servers.push(
        serverManager.getClangServer(
          `test${i}.cpp`,
          '',
          null,
          emptyServerSettings,
        ),
      );
    }
    invariant(servers[0]);
    expect(servers[0].isDisposed()).toBe(true);
    invariant(servers[1]);
    expect(servers[1].isDisposed()).toBe(false);
  });

  it('enforces a memory limit', async () => {
    const processModule = require('nuclide-commons/process');
    const {runCommand} = processModule;
    // Using real 'ps' is not stable enough in testing.
    // We'll just mock it out with an arbitrary value per process.
    jest
      .spyOn(processModule, 'runCommand')
      .mockImplementation((command, ...args) => {
        if (command === 'ps') {
          return Observable.of(
            serverManager._servers
              // $FlowFixMe Missing in typings
              .values()
              .map(server => server.getPID())
              .filter(Boolean)
              .map(pid => `${pid}\t1000`)
              .join('\n'),
          );
        }
        return runCommand(command, ...args);
      });

    serverManager.setMemoryLimit(0);
    const server = serverManager.getClangServer(
      'test.cpp',
      '',
      null,
      emptyServerSettings,
    );

    // We're still over the limit, but keep the last one alive.
    const server2 = serverManager.getClangServer(
      'test2.cpp',
      '',
      null,
      emptyServerSettings,
    );

    await waitsFor(() => server2.isReady(), 'server2 to become ready');

    await serverManager._checkMemoryUsage();
    expect(server.isDisposed()).toBe(true);
    expect(server2.isDisposed()).toBe(false);

    // It should be disposed once the next server gets created.
    const server3 = serverManager.getClangServer(
      'test3.cpp',
      '',
      null,
      emptyServerSettings,
    );

    await waitsFor(() => server3.isReady(), 'server3 to become ready');

    await serverManager._checkMemoryUsage();
    expect(server2.isDisposed()).toBe(true);
    expect(server3.isDisposed()).toBe(false);
  });
});
