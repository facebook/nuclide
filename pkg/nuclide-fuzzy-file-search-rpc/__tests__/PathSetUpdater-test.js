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
import invariant from 'assert';

import {Observable} from 'rxjs';
import {generateHgRepo1Fixture} from '../../nuclide-test-helpers';
import {WatchmanSubscription} from 'nuclide-watchman-helpers';

import {PathSet} from '../lib/process/PathSet';
import PathSetUpdater from '../lib/process/PathSetUpdater';
import * as hgUtils from '../../nuclide-hg-rpc/lib/hg-utils';

jest.setTimeout(20000);

describe('PathSetUpdater', () => {
  const INITIAL_PATHS = ['a', 'b'];
  let pathSet;
  let pathSetUpdater;
  let mockRepoPath;

  const createMockWatchmanSubscription = (directoryPath: string) => {
    return Promise.resolve(
      new WatchmanSubscription(
        /* subscriptionRoot */ mockRepoPath,
        /* pathFromSubscriptionRootToSubscriptionPath */ '.',
        /* subscriptionPath */ mockRepoPath,
        /* subscriptionName */ mockRepoPath,
        /* subscriptionCount */ 1,
        /* subscriptionOptions */ {fields: [], since: ''}, // Not used in this test.
      ),
    );
  };

  const mockWatchmanClient: Object = {
    watchDirectoryRecursive: createMockWatchmanSubscription,
    unwatch: null,
  };

  const emitMockWatchmanUpdate = (update: any) => {
    invariant(pathSetUpdater);
    invariant(pathSet);
    const subscription = pathSetUpdater._pathSetToSubscription.get(pathSet);
    if (!subscription) {
      return;
    }
    subscription.emit('change', update);
  };

  beforeEach(async () => {
    pathSet = new PathSet(INITIAL_PATHS, [], '');
    pathSetUpdater = new PathSetUpdater();
    jest.useFakeTimers();

    mockRepoPath = await generateHgRepo1Fixture();
  });

  describe('startUpdatingPathSet', () => {
    it('starts updating the pathSet, and returns a Disposable that can stop the updating.', async () => {
      // Mock out the dependency on fb-watchman.
      invariant(pathSetUpdater);
      jest
        .spyOn(pathSetUpdater, '_setupWatcherService')
        .mockImplementation(() => {
          invariant(pathSetUpdater);
          pathSetUpdater._watchmanClient = mockWatchmanClient;
          jest.spyOn(mockWatchmanClient, 'watchDirectoryRecursive');
          mockWatchmanClient.unwatch = jest.fn();
        });

      jest
        .spyOn(hgUtils, 'hgRunCommand')
        .mockImplementation(() =>
          Observable.of('[{ "path": "e", "status": "I"}]'),
        );

      // Attach the pathSetUpdater to the pathSet.
      invariant(pathSetUpdater);
      invariant(pathSet);
      const disposable = await pathSetUpdater.startUpdatingPathSet(
        pathSet,
        mockRepoPath,
      );
      expect(mockWatchmanClient.watchDirectoryRecursive).toHaveBeenCalledWith(
        mockRepoPath,
      );

      // Trigger mock 'file add' and 'file remove' events, and check that they
      // result in changes to the pathSet.
      const mockChanges = [
        {
          name: 'c',
          new: true,
          exists: true,
          mode: 1234,
        },
        {
          name: 'a',
          new: false,
          exists: false,
          mode: 1234,
        },
        {
          name: 'dir',
          new: true,
          exists: true,
          // This is a directory, and should be ignored.
          mode: 16384,
        },
        {
          name: 'e',
          // This is in .hgignore and should be ignored.
          new: true,
          exists: true,
          mode: 1234,
        },
      ];
      emitMockWatchmanUpdate(mockChanges);
      jest.advanceTimersByTime(5000);
      let newValues = (await pathSet.query('')).map(x => x.path);
      expect(newValues.sort()).toEqual(['/b', '/c']);

      // This is a no-op.
      emitMockWatchmanUpdate([
        {
          name: 'x',
          new: true,
          exists: false,
          mode: 1234,
        },
        {
          name: 'e',
          // This is in .hgignore and should be ignored.
          new: false,
          exists: false,
          mode: 1234,
        },
      ]);

      newValues = (await pathSet.query('')).map(x => x.path);
      expect(newValues.sort()).toEqual(['/b', '/c']);

      // Verify that disposing the Disposable stops updates to the pathSet.
      disposable.dispose();
      expect(mockWatchmanClient.unwatch).toHaveBeenCalledWith(mockRepoPath);
      const unnoticedChanges = [
        {
          name: 'd',
          new: true,
          exists: true,
          mode: 1234,
        },
        {
          name: 'b',
          new: false,
          exists: false,
          mode: 1234,
        },
      ];
      emitMockWatchmanUpdate(unnoticedChanges);
      const unchangedValues = (await pathSet.query('')).map(x => x.path);
      expect(unchangedValues.sort()).toEqual(newValues);
    });
  });
});
