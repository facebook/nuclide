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
 */

import type {ThriftClient} from 'big-dig/src/services/thrift/types';

import {getLogger} from 'log4js';
import filesystem_types from './gen-nodejs/filesystem_types';

const logger = getLogger('remote-fs');
const POLLING_INTERVAL_MS = 3000;

export class FileWatch {
  _watchId: string;
  _pollingInterval: any;
  _watchPath: string;
  _watchOptions: {recursive: boolean, excludes: Array<string>};

  _getClientWrapper: () => Promise<ThriftClient>;
  _fileChangesHandler: (
    basePath: string,
    changes: Array<filesystem_types.FileChangeEvent>,
  ) => void;

  constructor(
    getClientWrapper: () => Promise<ThriftClient>,
    watchPath: string,
    options: {recursive: boolean, excludes: Array<string>},
    handler: (
      basePath: string,
      changes: Array<filesystem_types.FileChangeEvent>,
    ) => void,
  ) {
    this._getClientWrapper = getClientWrapper;
    this._watchPath = watchPath;
    this._watchOptions = options;
    this._pollingInterval = null;
    this._fileChangesHandler = handler;
    this._startWatching();
  }

  async _startWatching(): Promise<void> {
    try {
      const client = await this._getClient();
      this._watchId = await client.watch(this._watchPath, this._watchOptions);
      this._pollingInterval = setInterval(async () => {
        const thriftClient = await this._getClient();
        const changes = await thriftClient.pollFileChanges(this._watchId);
        this._fileChangesHandler(this._watchPath, changes);
      }, POLLING_INTERVAL_MS);
    } catch (err) {
      logger.error('Unable to watch target directory', err);
      return Promise.reject(err);
    }
  }

  getWatchPath(): string {
    return this._watchPath;
  }

  getWatchOptions(): {recursive: boolean, excludes: Array<string>} {
    return this._watchOptions;
  }

  async _getClient<T>(): Promise<T> {
    const clientWrapper = await this._getClientWrapper();
    return clientWrapper.getClient();
  }

  async _unwatch(): Promise<void> {
    try {
      const client = await this._getClient();
      await client.unwatch(this._watchId);
    } catch (error) {
      logger.error('Unable to unwatch ', this._watchPath, this._watchOptions);
    }
  }

  _disposePollingInterval(): void {
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval);
      this._pollingInterval = null;
    }
  }

  dispose(): void {
    this._unwatch();
    this._disposePollingInterval();
  }
}
