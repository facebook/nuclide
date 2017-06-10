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

import type {PathSet} from './PathSet';
import type {WatchmanSubscription} from '../../../nuclide-watchman-helpers';

import {Disposable} from 'event-kit';
import invariant from 'assert';

import {WatchmanClient} from '../../../nuclide-watchman-helpers';

// TODO: This probably won't work on Windows, but we'll worry about that
// when Watchman officially supports Windows.
const S_IFDIR = 16384;

/**
 * This class keeps the PathSets passed to it up to date by using file system
 * watchers to observe when relevant file additions and deletions occur.
 * This class currently relies on the Nuclide WatchmanClient, which requires fb-watchman.
 */
// TODO (t7298196) Investigate falling back to Node watchers.
export default class PathSetUpdater {
  _pathSetToSubscription: Map<PathSet, WatchmanSubscription>;
  _watchmanClient: ?WatchmanClient;

  constructor() {
    this._pathSetToSubscription = new Map();
  }

  dispose() {
    if (this._watchmanClient) {
      this._watchmanClient.dispose();
    }
  }

  // Section: Add/Remove PathSets

  /**
   * @param pathSet The PathSet to keep updated.
   * @param localDirectory The directory for which we are interested in file
   * changes. This is likely to the be the same as the directory the PathSet
   * was created from.
   * @return Disposable that can be disposed to stop updating the PathSet.
   */
  async startUpdatingPathSet(
    pathSet: PathSet,
    localDirectory: string,
  ): Promise<Disposable> {
    const subscription = await this._addWatchmanSubscription(localDirectory);
    this._pathSetToSubscription.set(pathSet, subscription);

    subscription.on('change', files =>
      this._processWatchmanUpdate(
        subscription.pathFromSubscriptionRootToSubscriptionPath,
        pathSet,
        files,
      ),
    );
    return new Disposable(() => this._stopUpdatingPathSet(pathSet));
  }

  _stopUpdatingPathSet(pathSet: PathSet) {
    const subscription = this._pathSetToSubscription.get(pathSet);
    if (subscription) {
      this._pathSetToSubscription.delete(pathSet);
      this._removeWatchmanSubscription(subscription);
    }
  }

  // Section: Watchman Subscriptions

  _setupWatcherService() {
    if (this._watchmanClient) {
      return;
    }
    this._watchmanClient = new WatchmanClient();
  }

  async _addWatchmanSubscription(
    localDirectory: string,
  ): Promise<WatchmanSubscription> {
    if (!this._watchmanClient) {
      this._setupWatcherService();
    }
    invariant(this._watchmanClient);
    return this._watchmanClient.watchDirectoryRecursive(localDirectory);
  }

  _removeWatchmanSubscription(subscription: WatchmanSubscription): void {
    if (!this._watchmanClient) {
      return;
    }
    this._watchmanClient.unwatch(subscription.path);
  }

  // Section: PathSet Updating

  /**
   * Adds or removes paths from the pathSet based on the files in the update.
   * This method assumes the pathSet should be populated with file paths that
   * are *RELATIVE* to the localDirectory passed into PathSetUpdater::startUpdatingPathSet.
   * @param pathFromSubscriptionRootToDir The path from the watched
   *   root directory (what watchman actually watches) to the directory of interest
   *   (i.e. the localDirectory passed to PathSetUpdater::startUpdatingPathSet).
   *   For example, this string should be '' if those are the same.
   * @param pathSet The PathSet that should be updated by this watchman update.
   * @param files The `files` field of an fb-watchman update. Each file in the
   *   update is expected to contain fields for `name`, `new`, and `exists`.
   */
  _processWatchmanUpdate(
    pathFromSubscriptionRootToDir: ?string,
    pathSet: PathSet,
    files: any,
  ): void {
    const newPaths = [];
    const deletedPaths = [];

    files.forEach(file => {
      // Only keep track of files.
      // eslint-disable-next-line no-bitwise
      if ((file.mode & S_IFDIR) !== 0) {
        return;
      }
      if (!file.exists) {
        deletedPaths.push(file.name);
      } else if (file.new) {
        newPaths.push(file.name);
      }
    });

    if (newPaths.length) {
      pathSet.addPaths(newPaths);
    }
    if (deletedPaths.length) {
      pathSet.removePaths(deletedPaths);
    }
  }
}
