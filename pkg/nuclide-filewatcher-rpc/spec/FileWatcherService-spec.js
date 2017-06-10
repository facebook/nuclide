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

import type {WatchResult} from '..';
import {Emitter} from 'event-kit';
import fsPromise from 'nuclide-commons/fsPromise';
import * as watchmanHelpers from '../../nuclide-watchman-helpers';
import {generateFixture} from '../../nuclide-test-helpers';
import fs from 'fs';
import log4js from 'log4js';
import {
  watchFile,
  watchFileWithNode,
  watchDirectory,
  watchDirectoryRecursive,
} from '../lib/FileWatcherService';

const TEST_FILE = '/path/to/file';
const TEST_DIR = '/path/to';
const NODE_TEST_FILE = 'node_test_file';

describe('FileWatcherService', () => {
  let emitter;
  let statMock;
  let realpathMock;
  let fsWatchSpy;
  let nodeTestDirPath;
  let nodeTestFilePath;
  const createNodeTestFile = callback => {
    waitsForPromise(async () => {
      nodeTestDirPath = await generateFixture(
        'watchFileWithNodeTest',
        new Map([[NODE_TEST_FILE, null]]),
      );
      nodeTestFilePath = `${nodeTestDirPath}/${NODE_TEST_FILE}`;
      if (callback) {
        callback();
      }
    });
  };

  beforeEach(() => {
    const mockWatchmanClient = {
      hasSubscription: () => false,
      watchDirectoryRecursive() {
        emitter = new Emitter();
        // $FlowIgnore
        emitter.path = TEST_DIR;
        return Promise.resolve(emitter);
      },
    };

    spyOn(watchmanHelpers, 'WatchmanClient').andReturn(mockWatchmanClient);

    statMock = spyOn(fsPromise, 'stat').andCallFake(path => ({
      isFile: () => path === TEST_FILE,
    }));

    realpathMock = spyOn(fsPromise, 'realpath').andCallFake(x => x);
    fsWatchSpy = spyOn(fs, 'watch').andCallThrough();

    createNodeTestFile();
  });

  it('watches changes to files', () => {
    const watchReady = jasmine.createSpy('ready');
    runs(() => {
      watchDirectoryRecursive(TEST_DIR)
        .refCount()
        .subscribe({next: watchReady});
    });

    waitsFor(() => watchReady.wasCalled);

    const nextMock: (result: WatchResult) => mixed = jasmine.createSpy('next');
    const nextMockWithNode: (result: WatchResult) => mixed = jasmine.createSpy(
      'nextWithNode',
    );
    const parentNextMock = jasmine.createSpy('parentNext');
    const completeMock: () => mixed = jasmine.createSpy('complete');

    runs(() => {
      expect(watchReady).toHaveBeenCalledWith('SUCCESS');
      watchFile(TEST_FILE)
        .refCount()
        .subscribe({next: nextMock, complete: completeMock});
      watchDirectory(TEST_DIR).refCount().subscribe({next: parentNextMock});
      watchFileWithNode(nodeTestFilePath)
        .refCount()
        .subscribe({next: nextMockWithNode});
    });

    // Hacky: there's no good way of checking if the inner observables are ready.
    // For now, we know it subscribes after realpath resolves.
    waitsFor(() => realpathMock.callCount === 2 && fsWatchSpy.callCount === 1);

    // Simulate a file creation.
    runs(() => {
      emitter.emit('change', [
        {
          name: 'file',
          new: true,
          exists: true,
          mode: 0,
        },
      ]);
    });

    waitsFor(() => nextMock.wasCalled && parentNextMock.wasCalled);

    runs(() => {
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

      // Write to watchFileWithNode test file
      fs.writeFileSync(nodeTestFilePath, 'These are words.');
    });

    waitsFor(() => nextMock.callCount === 2);
    waitsFor(() => nextMockWithNode.wasCalled);

    runs(() => {
      // Regular changes don't affect parent directories.
      expect(parentNextMock.callCount).toBe(1);

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

      // Deletions are debounced..
      advanceClock(2000);
    });

    // Watch should complete after a delete.
    waitsFor(() => completeMock.wasCalled);
    waitsFor(() => nextMockWithNode.callCount === 2);

    runs(() => {
      expect(nextMock).toHaveBeenCalledWith({
        path: TEST_FILE,
        type: 'delete',
      });

      expect(nextMockWithNode).toHaveBeenCalledWith({
        path: nodeTestFilePath,
        type: 'delete',
      });

      // The parent dir should change again.
      expect(parentNextMock.callCount).toBe(2);
    });

    // Test that rewatching produces a new observer.
    const completeMock2 = jasmine.createSpy('completeMock2');
    const nextMockWithNode2 = jasmine.createSpy('nextMock2WithNode');

    runs(() => {
      watchFile(TEST_FILE).refCount().subscribe({complete: completeMock2});
      createNodeTestFile(() => {
        watchFileWithNode(nodeTestFilePath)
          .refCount()
          .subscribe({next: nextMockWithNode2});
      });
    });

    // Use the same hack again..
    waitsFor(() => realpathMock.callCount === 3);

    runs(() => {
      // Delete the file again.
      emitter.emit('change', [
        {
          name: 'file',
          new: false,
          exists: false,
          mode: 0,
        },
      ]);
      fs.unlinkSync(nodeTestFilePath);

      advanceClock(2000);
    });

    waitsFor(() => completeMock2.wasCalled && nextMockWithNode2.wasCalled);
  });

  it('debounces file deletions', () => {
    const changes = [];
    let completed = false;

    waitsForPromise(async () => {
      const watch = watchDirectoryRecursive(TEST_DIR).refCount();
      watch.subscribe();
      await watch.take(1).toPromise();

      watchFile(TEST_FILE).refCount().subscribe({
        next: change => changes.push(change),
        complete: () => {
          completed = true;
        },
      });
    });

    waitsFor(() => realpathMock.callCount === 1);

    runs(() => {
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

      advanceClock(2000);
    });

    waitsFor(() => completed);

    runs(() => {
      expect(changes).toEqual([
        {path: TEST_FILE, type: 'change'},
        {path: TEST_FILE, type: 'delete'},
      ]);
    });
  });

  it('errors for missing files', () => {
    statMock.andCallFake(() => {
      throw new Error();
    });

    const errorMock = jasmine.createSpy('errorMock');
    const errorMockWithNode = jasmine.createSpy('errorMockWithNode');
    runs(() => {
      fs.unlinkSync(nodeTestFilePath);
      watchFile(TEST_FILE).refCount().subscribe({error: errorMock});
      try {
        watchFileWithNode(nodeTestFilePath)
          .refCount()
          .subscribe({next: x => x});
      } catch (err) {
        errorMockWithNode();
      }
    });

    waitsFor(() => errorMock.wasCalled && errorMockWithNode.wasCalled);
  });

  it('warns when you try to watch the wrong entity type', () => {
    const warnSpy = jasmine.createSpy('warn');
    spyOn(log4js, 'getLogger').andReturn({warn: warnSpy});

    watchFile(TEST_DIR).refCount();
    waitsFor(() => warnSpy.wasCalled);

    watchDirectory(TEST_FILE).refCount();
    waitsFor(() => warnSpy.callCount === 2);
  });
});
