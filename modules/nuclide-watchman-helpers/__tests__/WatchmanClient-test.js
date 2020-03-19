/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
jest.setTimeout(15000);

import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import watchman from 'fb-watchman';
import {nextTick} from 'nuclide-commons/promise';
import WatchmanClient from '../lib/WatchmanClient';
import {generateFixture} from 'nuclide-commons/test-helpers';
import waitsFor from '../../../jest/waits_for';
import * as Path from '../lib/path';
import {DEFAULT_WATCHMAN_RECONNECT_DELAY_MS} from '../lib/WatchmanClient';

const FILE_MODE = 33188;

const sleep = n => new Promise(r => setTimeout(r, n));

describe.skip('WatchmanClient test suite', () => {
  let dirPath: string = '';
  let client: WatchmanClient = (null: any);

  beforeEach(async () => {
    client = new WatchmanClient();

    dirPath = await generateFixture(
      'watchman_helpers_test',
      new Map([
        // Many people use restrict_root_files so watchman only will watch folders
        // that have those listed files in them. watchmanconfig is always a root
        // file.
        ['.watchmanconfig', '{}'],
        ['test.txt', 'abc'],
        ['non-used-file.txt', 'def'],
        ['nested/nested-test.txt', 'ghi'],
      ]),
    );
    // TODO(hansonw): This is a big change in Watchman behavior- figure out what
    // this means for Nuclide's use.
    dirPath = fs.realpathSync(dirPath);
    await sleep(1010);
  });

  afterEach(() => {
    client.dispose();
  });

  describe('restore subscriptions', () => {
    async function testRestoreSubscriptions(
      onRestoreChange: (watchmanClient: watchman.Client) => void,
    ) {
      // First watchman init can be slow and flaky.
      const filePath = nuclideUri.join(dirPath, 'test.txt');
      const watcher = await client
        .watchDirectoryRecursive(dirPath)
        // Give it two retries.
        .catch(() => client.watchDirectoryRecursive(dirPath))
        .catch(() => client.watchDirectoryRecursive(dirPath));
      const changeHandler = jest.fn();
      watcher.on('change', changeHandler);
      await sleep(1010);
      fs.writeFileSync(filePath, 'def');
      await waitsFor(() => changeHandler.mock.calls.length > 0);
      expect(changeHandler.mock.calls.length).toBe(1);
      expect(changeHandler.mock.calls[0][0]).toEqual([
        {
          name: 'test.txt',
          mode: FILE_MODE,
          new: false,
          exists: true,
        },
      ]);
      const internalClient = await client._clientPromise;
      onRestoreChange(internalClient);
      internalClient.end();
      await sleep(1000); // Wait for watchman to watch the directory.
      advanceClock(3000); // Pass the settle filesystem time.
      await sleep(1000); // Wait for the client to restore subscriptions.
      fs.unlinkSync(filePath);
      await waitsFor(() => changeHandler.mock.calls.length > 1);
      expect(changeHandler.mock.calls.length).toBe(2);
      expect(changeHandler.mock.calls[1][0]).toEqual([
        {
          name: 'test.txt',
          mode: FILE_MODE,
          new: false,
          exists: false,
        },
      ]);
      // Cleanup watch resources.
      await (() => client.unwatch(dirPath))();
    }

    it('restores subscriptions on client end', async () => {
      await testRestoreSubscriptions(watchmanClient => {
        // End the socket client to watchman to trigger restore subscriptions.
        watchmanClient.end();
      });
    });

    it('restores subscriptions on client error', async () => {
      await testRestoreSubscriptions(watchmanClient => {
        // End the socket client to watchman to trigger restore subscriptions.
        watchmanClient.emit('error', new Error('fake error'));
      });
    });

    /**
     * This simulates the case where:
     * 1. watchman fails, and then
     * 2. the reconnection fails on startup
     * 3. subsequent reconnections can still succeed.
     *
     * We need to make sure we don't end up in a deadlock where the first reconnection
     * attempt blocks subsequent ones.
     */
    it('restores subscriptions on client startup failure', async () => {
      await testRestoreSubscriptions(watchmanClient => {
        let counter = 0;
        const oldConnect = watchman.Client.prototype.connect;
        jest
          .spyOn(watchman.Client.prototype, 'connect')
          .mockImplementation(function() {
            if (counter++ === 0) {
              this.emit('error', new Error('startup error'));
            } else {
              oldConnect.apply(this);
            }
          });
        watchmanClient.emit('error', new Error('fake error'));
      });
    });
  });

  describe('cleanup watchers after unwatch', () => {
    it('unwatch cleans up watchman subscriptions resources', async () => {
      const dirRealPath = fs.realpathSync(dirPath);
      await client.watchDirectoryRecursive(dirPath);
      const watchList = await client._watchList();
      expect(watchList.indexOf(dirRealPath)).not.toBe(-1);
      // $FlowIssue
      client.dispose = () => {};
      await client.unwatch(dirPath);
      expect(client.hasSubscription(dirPath)).toBeFalsy();
      // Didn't remove it from the watched directories.
      const noWatchListCleanup = await client._watchList();
      expect(noWatchListCleanup.indexOf(dirRealPath)).not.toBe(-1);
    });
  });

  describe('watchProject()', () => {
    it('should be able to watch nested project folders, but cleanup watchRoot', async () => {
      const dirRealPath = fs.realpathSync(dirPath);
      const nestedDirPath = nuclideUri.join(dirPath, 'nested');
      const {
        watch: watchRoot,
        relative_path: relativePath,
      } = await client._watchProject(nestedDirPath);
      expect(watchRoot).toBe(dirRealPath);
      expect(relativePath).toBe('nested');
    });
  });
});

describe('WatchmanClient', () => {
  it('delays reconnecting with exponential backoff', async () => {
    jest.useFakeTimers();

    const functionsMap = {};
    const mockWatchmanClient = {
      on: (name, func) => {
        functionsMap[name] = func;
      },
      emit: (name, ...values) => {
        functionsMap[name](...values);
      },
      removeAllListeners: jest.fn(),
      end: jest.fn(),
      command: (args, callback) => callback(false, 'my response'),
    };
    jest.spyOn(watchman, 'Client').mockImplementation(() => {
      return Promise.resolve(mockWatchmanClient);
    });
    const client = new WatchmanClient();
    const reconnectSpy = jest.spyOn(client, '_reconnectClient');
    jest.advanceTimersByTime(500); // wait for debouncing
    expect(reconnectSpy.mock.calls.length).toBe(0);

    await client.watchDirectoryRecursive('someDir', 'mySubscriptionName');

    jest
      .spyOn(client, '_reconnectClient')
      .mockImplementationOnce(async () => {
        return Promise.reject(new Error('test failure'));
      })
      .mockImplementationOnce(async () => {
        return Promise.reject(new Error('test failure 2'));
      });

    const reconnectDelay = DEFAULT_WATCHMAN_RECONNECT_DELAY_MS;
    expect(client._reconnectDelayMs).toBe(reconnectDelay);

    // mock disconnecting twice, expect exponential backoff
    mockWatchmanClient.emit('end');
    jest.advanceTimersByTime(500);
    await nextTick();
    expect(reconnectSpy.mock.calls.length).toBe(1);
    jest.advanceTimersByTime(100);
    await nextTick();
    expect(client._reconnectDelayMs).toBe(2 * reconnectDelay);

    mockWatchmanClient.emit('end');
    jest.advanceTimersByTime(500);
    await nextTick();
    expect(reconnectSpy.mock.calls.length).toBe(2);
    jest.advanceTimersByTime(100);
    await nextTick();
    expect(client._reconnectDelayMs).toBe(4 * reconnectDelay);

    // now succeed, expect reconnect delay to be reset
    mockWatchmanClient.emit('end');
    jest.advanceTimersByTime(1000);
    await nextTick();
    expect(reconnectSpy.mock.calls.length).toBe(3);
    jest.useRealTimers(); // for some reason, jest mock clocks stop working here
    await sleep(3000);

    await nextTick();
    expect(client._reconnectDelayMs).toBe(reconnectDelay);
    reconnectSpy.mockRestore();
  });

  it('keeps exponential backoff until all subscriptions are successful', async () => {
    jest.useFakeTimers();

    const functionsMap = {};
    const mockWatchmanClient = {
      on: (name, func) => {
        functionsMap[name] = func;
      },
      emit: (name, ...values) => {
        functionsMap[name](...values);
      },
      removeAllListeners: jest.fn(),
      end: jest.fn(),
      command: (args, callback) => callback(false, 'my response'),
    };
    jest.spyOn(Path, 'getWatchmanBinaryPath').mockImplementation(() => {
      return '/testing';
    });
    jest.spyOn(watchman, 'Client').mockImplementation(() => {
      return Promise.resolve(mockWatchmanClient);
    });
    const client = new WatchmanClient();
    const watchSpy = jest.spyOn(client, '_watchProject');
    jest.advanceTimersByTime(500); // wait for debouncing
    expect(watchSpy.mock.calls.length).toBe(0);

    const dir1 = 'someDir1';
    const dir2 = 'someDir2';
    const dir3 = 'someDir3';
    const watch1 = {watch: dir1, relative_path: dir1};
    const watch2 = {watch: dir2, relative_path: dir2};
    const watch3 = {watch: dir3, relative_path: dir3};
    jest
      .spyOn(client, '_watchProject')
      // initialize successfully
      .mockImplementationOnce(async () => {
        return Promise.resolve(watch1);
      })
      .mockImplementationOnce(async () => {
        return Promise.resolve(watch2);
      })
      .mockImplementationOnce(async () => {
        return Promise.resolve(watch2);
      })
      // fail for 1/3 subscriptions
      .mockImplementationOnce(async () => {
        return Promise.resolve(watch1);
      })
      .mockImplementationOnce(async () => {
        return Promise.resolve(watch2);
      })
      .mockImplementationOnce(async () => {
        return Promise.reject(new Error('test failure'));
      })
      // fail again
      .mockImplementationOnce(async () => {
        return Promise.resolve(watch1);
      })
      .mockImplementationOnce(async () => {
        return Promise.resolve(watch2);
      })
      .mockImplementationOnce(async () => {
        return Promise.reject(new Error('test failure'));
      })
      // now successfully reconect 3/3
      .mockImplementationOnce(async () => {
        return Promise.resolve(watch1);
      })
      .mockImplementationOnce(async () => {
        return Promise.resolve(watch2);
      })
      .mockImplementationOnce(async () => {
        return Promise.resolve(watch3);
      });

    await client.watchDirectoryRecursive(dir1, 'mySubscriptionName1');
    await client.watchDirectoryRecursive(dir2, 'mySubscriptionName2');
    await client.watchDirectoryRecursive(dir3, 'mySubscriptionName3');

    const reconnectDelay = DEFAULT_WATCHMAN_RECONNECT_DELAY_MS;
    expect(client._reconnectDelayMs).toBe(reconnectDelay);
    expect(watchSpy.mock.calls.length).toBe(3);

    // mock disconnecting twice, expect exponential backoff
    mockWatchmanClient.emit('end');
    jest.advanceTimersByTime(500);
    await nextTick();
    expect(watchSpy.mock.calls.length).toBe(6);
    jest.advanceTimersByTime(100);
    await nextTick();
    expect(client._reconnectDelayMs).toBe(2 * reconnectDelay);

    mockWatchmanClient.emit('end');
    jest.advanceTimersByTime(500);
    await nextTick();
    expect(watchSpy.mock.calls.length).toBe(9);
    jest.advanceTimersByTime(100);
    await nextTick();
    expect(client._reconnectDelayMs).toBe(4 * reconnectDelay);

    // now succeed, expect reconnect delay to be reset
    mockWatchmanClient.emit('end');
    jest.advanceTimersByTime(1000);
    await nextTick();
    expect(watchSpy.mock.calls.length).toBe(12);

    jest.advanceTimersByTime(3000);
    await nextTick();
    expect(client._reconnectDelayMs).toBe(reconnectDelay);
  });
});
