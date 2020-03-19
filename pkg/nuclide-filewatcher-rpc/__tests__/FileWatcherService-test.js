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
jest.setTimeout(25000);

import {Emitter} from 'event-kit';

let emitter;

jest.mock('nuclide-watchman-helpers', () => {
  const mockWatchmanClient = {
    hasSubscription: () => false,
    watchDirectoryRecursive() {
      emitter = new Emitter();
      // $FlowIgnore
      emitter.path = TEST_DIR;
      return Promise.resolve(emitter);
    },
  };

  return {
    WatchmanClient: jest.fn(() => mockWatchmanClient),
  };
});
jest.unmock('log4js');

import type {WatchResult} from '..';
import fsPromise from 'nuclide-commons/fsPromise';
import {sleep, nextTick} from 'nuclide-commons/promise';
import {generateFixture} from 'nuclide-commons/test-helpers';
import fs from 'fs';
import log4js from 'log4js';
import {
  watchFile,
  watchWithNode,
  watchDirectory,
  watchDirectoryRecursive,
} from '../lib/FileWatcherService';
import waitsFor from '../../../jest/waits_for';

const TEST_FILE = '/path/to/file';
const TEST_DIR = '/path/to';
const NODE_TEST_FILE = 'node_test_file';

describe('FileWatcherService', () => {
  let statMock;
  let realpathMock;
  let nodeTestDirPath;
  let nodeTestFilePath;
  const createNodeTestFile = async callback => {
    nodeTestDirPath = await generateFixture(
      'watchWithNodeTest',
      new Map([[NODE_TEST_FILE, null]]),
    );
    nodeTestFilePath = `${nodeTestDirPath}/${NODE_TEST_FILE}`;
    if (callback) {
      callback();
    }
  };

  beforeEach(async () => {
    jest.restoreAllMocks();
    statMock = jest.spyOn(fsPromise, 'stat').mockImplementation(path => ({
      isFile: () => path === TEST_FILE,
    }));

    realpathMock = jest
      .spyOn(fsPromise, 'realpath')
      .mockImplementation(x => Promise.resolve(x));
    jest.spyOn(fs, 'watch');

    await createNodeTestFile();
  });

  it('watches changes to files', async () => {
    const watchReady = jest.fn();
    watchDirectoryRecursive(TEST_DIR)
      .refCount()
      .subscribe({next: watchReady});

    await waitsFor(() => watchReady.mock.calls.length > 0);

    const nextMock: (result: WatchResult) => mixed = jest.fn();
    const nextMockWithNode: (result: WatchResult) => mixed = jest.fn();
    const parentNextMock = jest.fn();
    const completeMock: () => mixed = jest.fn();

    expect(watchReady).toHaveBeenCalledWith('SUCCESS');
    watchFile(TEST_FILE)
      .refCount()
      .subscribe({next: nextMock, complete: completeMock});
    watchDirectory(TEST_DIR)
      .refCount()
      .subscribe({next: parentNextMock});
    watchWithNode(nodeTestFilePath)
      .refCount()
      .subscribe({next: nextMockWithNode});

    // Hacky: there's no good way of checking if the inner observables are ready.
    // For now, we know it subscribes after realpath resolves.
    await waitsFor(() => realpathMock.mock.calls.length === 2);

    // Simulate a file creation.
    emitter.emit('change', [
      {
        name: 'file',
        new: true,
        exists: true,
        mode: 0,
      },
    ]);

    await waitsFor(
      () =>
        nextMock.mock.calls.length > 0 && parentNextMock.mock.calls.length > 0,
    );

    expect(nextMock).toHaveBeenCalledWith({
      path: TEST_FILE,
      type: 'change',
    });

    // The parent dir should change.
    expect(parentNextMock).toHaveBeenCalledWith({
      path: TEST_DIR,
      type: 'change',
    });

    // Simulate a regular file change.
    emitter.emit('change', [
      {
        name: 'file',
        new: false,
        exists: true,
        mode: 0,
      },
    ]);

    // Write to watcWithNode test file.
    // Add a slight delay to allow fs.watch to start up.
    await sleep(100);
    fs.writeFileSync(nodeTestFilePath, 'These are words.');

    await waitsFor(() => nextMock.mock.calls.length === 2);
    await waitsFor(() => nextMockWithNode.mock.calls.length > 0);

    // Regular changes don't affect parent directories.
    expect(parentNextMock.mock.calls.length).toBe(1);

    // Simulate a file deletion.
    emitter.emit('change', [
      {
        name: 'file',
        new: false,
        exists: false,
        mode: 0,
      },
    ]);
    fs.unlinkSync(nodeTestFilePath);

    // Watch should complete after a delete.
    await waitsFor(() => completeMock.mock.calls.length > 0);
    await waitsFor(() => nextMockWithNode.mock.calls.length > 1);

    expect(nextMock).toHaveBeenCalledWith({
      path: TEST_FILE,
      type: 'delete',
    });

    expect(nextMockWithNode).toHaveBeenCalledWith({
      path: nodeTestFilePath,
      type: 'delete',
    });

    // The parent dir should change again.
    expect(parentNextMock.mock.calls.length).toBe(2);

    // Test that rewatching produces a new observer.
    const completeMock2 = jest.fn();
    const nextMockWithNode2 = jest.fn();

    watchFile(TEST_FILE)
      .refCount()
      .subscribe({complete: completeMock2});
    createNodeTestFile(() => {
      watchWithNode(nodeTestFilePath)
        .refCount()
        .subscribe({next: nextMockWithNode2});
    });

    // Use the same hack again..
    await waitsFor(() => realpathMock.mock.calls.length === 3);

    // Delete the file again.
    emitter.emit('change', [
      {
        name: 'file',
        new: false,
        exists: false,
        mode: 0,
      },
    ]);

    // Give fs.watch some time to start up.
    await sleep(100);
    fs.unlinkSync(nodeTestFilePath);

    await waitsFor(
      () =>
        completeMock2.mock.calls.length > 0 &&
        nextMockWithNode2.mock.calls.length > 0,
    );
  });

  it('debounces file deletions', async () => {
    const changes = [];
    let completed = false;

    const watch = watchDirectoryRecursive(TEST_DIR).refCount();
    watch.subscribe();
    await watch.take(1).toPromise();

    watchFile(TEST_FILE)
      .refCount()
      .subscribe({
        next: change => changes.push(change),
        complete: () => {
          completed = true;
        },
      });

    await waitsFor(() => realpathMock.mock.calls.length === 1);

    // A file gets deleted and then created.
    emitter.emit('change', [
      {
        name: 'file',
        new: false,
        exists: false,
        mode: 0,
      },
    ]);
    emitter.emit('change', [
      {
        name: 'file',
        new: true,
        exists: true,
        mode: 0,
      },
    ]);

    // The deletion should be cancelled out.
    expect(changes).toEqual([{path: TEST_FILE, type: 'change'}]);

    emitter.emit('change', [
      {
        name: 'file',
        new: false,
        exists: false,
        mode: 0,
      },
    ]);

    await waitsFor(() => completed);

    expect(changes).toEqual([
      {path: TEST_FILE, type: 'change'},
      {path: TEST_FILE, type: 'delete'},
    ]);
  });

  it('errors for missing files', async () => {
    statMock.mockImplementation(() => {
      throw new Error();
    });

    const errorMock = jest.fn();
    const errorMockWithNode = jest.fn();
    fs.unlinkSync(nodeTestFilePath);
    watchFile(TEST_FILE)
      .refCount()
      .subscribe({error: errorMock});
    watchWithNode(nodeTestFilePath)
      .refCount()
      .subscribe({
        next: x => x,
        error() {
          errorMockWithNode();
        },
      });

    await waitsFor(
      () =>
        errorMock.mock.calls.length > 0 &&
        errorMockWithNode.mock.calls.length > 0,
    );
  });

  it('allows watching non-existant files', async () => {
    const changes = [];

    statMock.mockImplementation(() => {
      // eslint-disable-next-line prefer-promise-reject-errors
      return Promise.reject({code: 'ENOENT'});
    });

    const watch = watchDirectoryRecursive(TEST_DIR).refCount();
    watch.subscribe();
    await watch.take(1).toPromise();

    watchFile(TEST_FILE)
      .refCount()
      .subscribe({
        next: change => changes.push(change),
      });

    await nextTick();

    emitter.emit('change', [
      {
        name: 'file',
        new: true,
        exists: true,
        mode: 0,
      },
    ]);

    expect(changes).toEqual([{path: TEST_FILE, type: 'change'}]);
  });

  it('warns when you try to watch the wrong entity type', async () => {
    const warnSpy = jest.fn();
    jest.spyOn(log4js, 'getLogger').mockReturnValue({warn: warnSpy});

    watchFile(TEST_DIR).refCount();
    await waitsFor(() => warnSpy.mock.calls.length > 0);

    watchDirectory(TEST_FILE).refCount();
    await waitsFor(() => warnSpy.mock.calls.length === 2);
  });
});
