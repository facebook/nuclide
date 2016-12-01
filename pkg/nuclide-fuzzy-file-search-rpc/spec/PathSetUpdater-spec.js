'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import invariant from 'assert';
import nuclideUri from '../../commons-node/nuclideUri';

import {WatchmanSubscription} from '../../nuclide-watchman-helpers';

import {PathSet} from '../lib/PathSet';
import PathSetUpdater from '../lib/PathSetUpdater';

describe('PathSetUpdater', () => {
  const MOCK_WATCHMAN_PROJECT_ROOT = '/Mock/Root';
  const INITIAL_PATHS = ['a', 'b'];
  const TEST_DIRECTORY = '/Mock/Root/To/Test/Dir';
  const RELATIVE_PATH = nuclideUri.relative(MOCK_WATCHMAN_PROJECT_ROOT, TEST_DIRECTORY);
  let pathSet;
  let pathSetUpdater;

  const createMockWatchmanSubscription = (directoryPath: string) => {
    return Promise.resolve(new WatchmanSubscription(
      /* subscriptionRoot */ MOCK_WATCHMAN_PROJECT_ROOT,
      /* pathFromSubscriptionRootToSubscriptionPath */ RELATIVE_PATH,
      /* subscriptionPath */ TEST_DIRECTORY,
      /* subscriptionName */ TEST_DIRECTORY,
      /* subscriptionCount */ 1,
      /* subscriptionOptions */ {fields: [], since: ''}, // Not used in this test.
    ));
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


  beforeEach(() => {
    pathSet = new PathSet(INITIAL_PATHS, [], '');
    pathSetUpdater = new PathSetUpdater();
  });

  describe('startUpdatingPathSet', () => {
    it('starts updating the pathSet, and returns a Disposable that can stop the updating.', () => {
      // Mock out the dependency on fb-watchman.
      invariant(pathSetUpdater);
      spyOn(pathSetUpdater, '_setupWatcherService').andCallFake(() => {
        invariant(pathSetUpdater);
        pathSetUpdater._watchmanClient = mockWatchmanClient;
        spyOn(mockWatchmanClient, 'watchDirectoryRecursive').andCallThrough();
        spyOn(mockWatchmanClient, 'unwatch');
      });

      waitsForPromise(async () => {
        // Attach the pathSetUpdater to the pathSet.
        invariant(pathSetUpdater);
        invariant(pathSet);
        const disposable = await pathSetUpdater.startUpdatingPathSet(pathSet, TEST_DIRECTORY);
        expect(mockWatchmanClient.watchDirectoryRecursive).toHaveBeenCalledWith(TEST_DIRECTORY);

        // Trigger mock 'file add' and 'file remove' events, and check that they
        // result in changes to the pathSet.
        const mockChanges = [
          {
            name: nuclideUri.join(RELATIVE_PATH, 'c'),
            new: true,
            exists: true,
            mode: 1234,
          },
          {
            name: nuclideUri.join(RELATIVE_PATH, 'a'),
            new: false,
            exists: false,
            mode: 1234,
          },
          {
            name: nuclideUri.join(RELATIVE_PATH, 'dir'),
            new: true,
            exists: true,
            // This is a directory, and should be ignored.
            mode: 16384,
          },
        ];
        emitMockWatchmanUpdate(mockChanges);
        let newValues = pathSet.query('').map(x => x.path);
        expect(newValues.sort()).toEqual(['/b', '/c']);

        // This is a no-op.
        emitMockWatchmanUpdate([
          {
            name: nuclideUri.join(RELATIVE_PATH, 'x'),
            new: true,
            exists: false,
            mode: 1234,
          },
        ]);
        newValues = pathSet.query('').map(x => x.path);
        expect(newValues.sort()).toEqual(['/b', '/c']);

        // Verify that disposing the Disposable stops updates to the pathSet.
        disposable.dispose();
        expect(mockWatchmanClient.unwatch).toHaveBeenCalledWith(TEST_DIRECTORY);
        const unnoticedChanges = [
          {
            name: nuclideUri.join(RELATIVE_PATH, 'd'),
            new: true,
            exists: true,
            mode: 1234,
          },
          {
            name: nuclideUri.join(RELATIVE_PATH, 'b'),
            new: false,
            exists: false,
            mode: 1234,
          },
        ];
        emitMockWatchmanUpdate(unnoticedChanges);
        const unchangedValues = pathSet.query('').map(x => x.path);
        expect(unchangedValues.sort()).toEqual(newValues);
      });
    });
  });

});
