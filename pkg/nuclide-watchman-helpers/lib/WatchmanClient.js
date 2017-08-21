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

import nuclideUri from 'nuclide-commons/nuclideUri';
import watchman from 'fb-watchman';
import {serializeAsyncCall, sleep} from 'nuclide-commons/promise';
import {maybeToString} from 'nuclide-commons/string';
import {getWatchmanBinaryPath} from './path';
import WatchmanSubscription from './WatchmanSubscription';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-watchman-helpers');
const WATCHMAN_SETTLE_TIME_MS = 2500;

import type {WatchmanSubscriptionOptions} from './WatchmanSubscription';

type WatchmanSubscriptionResponse = {
  root: string,
  subscription: string,
  files?: Array<FileChange>,
  'state-enter'?: string,
  'state-leave'?: string,
  metadata?: Object,
  canceled?: boolean,
};

export type FileChange = {
  name: string,
  new: boolean,
  exists: boolean,
  mode: number,
};

export default class WatchmanClient {
  _subscriptions: Map<string, WatchmanSubscription>;
  _clientPromise: Promise<watchman.Client>;
  _serializedReconnect: () => Promise<void>;

  constructor() {
    this._initWatchmanClient();
    this._serializedReconnect = serializeAsyncCall(() =>
      this._reconnectClient(),
    );
    this._subscriptions = new Map();
  }

  async dispose(): Promise<void> {
    const client = await this._clientPromise;
    client.removeAllListeners(); // disable reconnection
    client.end();
  }

  async _initWatchmanClient(): Promise<void> {
    this._clientPromise = this._createClientPromise();

    const client = await this._clientPromise;
    client.on('end', () => {
      logger.info('Watchman client ended');
      client.removeAllListeners();
      this._serializedReconnect();
    });
    client.on('error', error => {
      logger.error('Error while talking to watchman: ', error);
      // If Watchman encounters an error in the middle of a command, it may never finish!
      // The client must be immediately killed here so that the command fails and
      // `serializeAsyncCall` can be unblocked. Otherwise, we end up in a deadlock.
      client.removeAllListeners();
      client.end();
      // Those are errors in deserializing a stream of changes.
      // The only possible recovery here is reconnecting a new client,
      // but the failed to serialize events will be missed.
      // t9353878
      this._serializedReconnect();
    });
    client.on('subscription', this._onSubscriptionResult.bind(this));
  }

  async _createClientPromise(): Promise<watchman.Client> {
    return new watchman.Client({
      watchmanBinaryPath: await getWatchmanBinaryPath(),
    });
  }

  async _reconnectClient(): Promise<void> {
    logger.error('Watchman client disconnected, reconnecting a new client!');
    await this._initWatchmanClient();
    logger.info('Watchman client re-initialized, restoring subscriptions');
    await this._restoreSubscriptions();
  }

  async _restoreSubscriptions(): Promise<void> {
    const watchSubscriptions = Array.from(this._subscriptions.values());
    await Promise.all(
      watchSubscriptions.map(async (subscription: WatchmanSubscription) => {
        await this._watchProject(subscription.path);
        // We have already missed the change events from the disconnect time,
        // watchman could have died, so the last clock result is not valid.
        await sleep(WATCHMAN_SETTLE_TIME_MS);
        // Register the subscriptions after the filesystem settles.
        subscription.options.since = await this._clock(subscription.root);
        await this._subscribe(
          subscription.root,
          subscription.name,
          subscription.options,
        );
      }),
    );
  }

  _getSubscription(entryPath: string): ?WatchmanSubscription {
    return this._subscriptions.get(nuclideUri.normalize(entryPath));
  }

  _setSubscription(
    entryPath: string,
    subscription: WatchmanSubscription,
  ): void {
    this._subscriptions.set(nuclideUri.normalize(entryPath), subscription);
  }

  _deleteSubscription(entryPath: string): void {
    this._subscriptions.delete(nuclideUri.normalize(entryPath));
  }

  _onSubscriptionResult(response: WatchmanSubscriptionResponse): void {
    const subscription = this._getSubscription(response.subscription);
    if (subscription == null) {
      logger.error('Subscription not found for response:!', response);
      return;
    }
    if (!Array.isArray(response.files)) {
      if (response.canceled === true) {
        logger.info(`Watch for ${response.root} was deleted.`);
        // Ending the client will trigger a reconnect.
        this._clientPromise.then(client => client.end());
        return;
      }
      // TODO(most): use state messages to decide on when to send updates.
      const stateEnter = response['state-enter'];
      const stateLeave = response['state-leave'];
      const stateMessage =
        stateEnter != null
          ? `Entering ${stateEnter}`
          : `Leaving ${maybeToString(stateLeave)}`;
      logger.info(`Subscription state: ${stateMessage}`);
      return;
    }
    subscription.emit('change', response.files);
  }

  async watchDirectoryRecursive(
    localDirectoryPath: string,
    subscriptionName?: string = localDirectoryPath,
    subscriptionOptions?: WatchmanSubscriptionOptions,
  ): Promise<WatchmanSubscription> {
    const existingSubscription = this._getSubscription(subscriptionName);
    if (existingSubscription) {
      existingSubscription.subscriptionCount++;
      return existingSubscription;
    } else {
      const {
        watch: watchRoot,
        relative_path: relativePath,
      } = await this._watchProject(localDirectoryPath);
      const clock = await this._clock(watchRoot);
      const options: WatchmanSubscriptionOptions = {
        ...subscriptionOptions,
        fields: ['name', 'new', 'exists', 'mode'],
        since: clock,
      };
      if (relativePath && !options.expression) {
        options.relative_root = relativePath;
      }
      // Try this thing out where we always set empty_on_fresh_instance. Eden will be a lot happier
      // if we never ask Watchman to do something that results in a glob(**) near the root.
      options.empty_on_fresh_instance = true;

      // relativePath is undefined if watchRoot is the same as directoryPath.
      const subscription = new WatchmanSubscription(
        /* subscriptionRoot */ watchRoot,
        /* pathFromSubscriptionRootToSubscriptionPath */ relativePath,
        /* subscriptionPath */ localDirectoryPath,
        /* subscriptionName */ subscriptionName,
        /* subscriptionCount */ 1,
        /* subscriptionOptions */ options,
      );
      this._setSubscription(subscriptionName, subscription);
      await this._subscribe(watchRoot, subscriptionName, options);
      return subscription;
    }
  }

  hasSubscription(entryPath: string): boolean {
    return Boolean(this._getSubscription(entryPath));
  }

  async unwatch(entryPath: string): Promise<void> {
    const subscription = this._getSubscription(entryPath);

    if (subscription == null) {
      logger.error('No watcher entity found with path:', entryPath);
      return;
    }

    if (--subscription.subscriptionCount === 0) {
      await this._unsubscribe(subscription.path, subscription.name);
      this._deleteSubscription(entryPath);
    }
  }

  /**
   * List all (watched) files in the given directory.
   * Paths will be relative.
   */
  async listFiles(
    entryPath: string,
    options?: {[name: string]: any} = {},
  ): Promise<Array<string>> {
    const {watch, relative_path} = await this._watchProject(entryPath);
    const result = await this._command('query', watch, {
      expression: [
        'allof',
        ['type', 'f'], // all files
        ['exists'],
      ],
      // Providing `path` will let watchman use path generator, and will perform
      // a tree walk with respect to the relative_root and path provided.
      // Path generator will do less work unless the root path of the repository
      // is passed in as an entry path.
      path: [''],
      fields: ['name'], // names only
      relative_root: relative_path,
      ...options,
    });
    return result.files;
  }

  async _watchList(): Promise<Array<string>> {
    const {roots} = await this._command('watch-list');
    return roots;
  }

  _unsubscribe(
    subscriptionPath: string,
    subscriptionName: string,
  ): Promise<any> {
    return this._command('unsubscribe', subscriptionPath, subscriptionName);
  }

  async _watch(directoryPath: string): Promise<any> {
    const response = await this._command('watch', directoryPath);
    if (response.warning) {
      logger.error('watchman warning: ', response.warning);
    }
  }

  async _watchProject(directoryPath: string): Promise<any> {
    const response = await this._command('watch-project', directoryPath);
    if (response.warning) {
      logger.error('watchman warning: ', response.warning);
    }
    return response;
  }

  async _clock(directoryPath: string): Promise<string> {
    const {clock} = await this._command('clock', directoryPath);
    return clock;
  }

  _subscribe(
    watchRoot: string,
    subscriptionName: ?string,
    options: WatchmanSubscriptionOptions,
  ): Promise<WatchmanSubscription> {
    return this._command('subscribe', watchRoot, subscriptionName, options);
  }

  /*
   * Promisify calls to watchman client.
   */
  _command(...args: Array<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      this._clientPromise
        .then(client => {
          client.command(
            args,
            (error, response) => (error ? reject(error) : resolve(response)),
          );
        })
        .catch(reject);
    });
  }
}
