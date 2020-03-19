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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {BigDigClient} from 'big-dig/src/client';
import type {ThriftClient} from 'big-dig/src/services/thrift/types';
import type {DirectoryEntry, WriteOptions} from '../../../nuclide-fs';

import {FS_SERVICE_CONFIG} from 'big-dig/src/thrift-services/fs/service-config';
import fs from 'fs';
import {getLogger} from 'log4js';
import {memoize} from 'lodash';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {RemoteFileSystemClient} from 'big-dig/src/thrift-services/fs/types';
import {convertToFsFileStat, convertToFsDirectoryEntries} from './util';
import filesystem_types from 'big-dig/src/thrift-services/fs/gen-nodejs/filesystem_types';

const BUFFER_ENCODING = 'utf-8';
const logger = getLogger('thrift-rfs-adapters');

class ThriftRfsClientAdapter {
  _client: RemoteFileSystemClient;

  constructor(client: RemoteFileSystemClient) {
    this._client = client;
  }
  async chmod(uri: string, mode: number): Promise<void> {
    return this._client.chmod(uri, mode);
  }
  async chown(uri: string, uid: number, gid: number): Promise<void> {
    return this._client.chown(uri, uid, gid);
  }
  async close(fd: number): Promise<void> {
    return this._client.close(fd);
  }

  /**
   * Runs the equivalent of `cp sourceUri destinationUri`.
   * @return true if the operation was successful; false if it wasn't.
   */
  async copy(
    sourceUri: NuclideUri,
    destinationUri: NuclideUri,
  ): Promise<boolean> {
    try {
      await this._client.copy(
        nuclideUri.getPath(sourceUri),
        nuclideUri.getPath(destinationUri),
        {
          overwrite: false,
        },
      );
    } catch (err) {
      if (err.code === 'EEXIST') {
        // expected if the targetPath already exists
        return false;
      }
      throw err;
    }
    return true;
  }

  /**
   * Runs the equivalent of `cp -R sourceUri destinationUri`.
   * @return true if the operation was successful; false if it wasn't.
   */
  async copyDir(
    sourceUri: NuclideUri,
    destinationUri: NuclideUri,
  ): Promise<boolean> {
    try {
      const oldContents = (await Promise.all([
        this.mkdir(destinationUri),
        this.readdir(sourceUri),
      ]))[1];

      const didCopyAll = await Promise.all(
        oldContents.map(([file, isFile]) => {
          const oldItem = nuclideUri.join(sourceUri, file);
          const newItem = nuclideUri.join(destinationUri, file);
          if (isFile) {
            return this.copy(oldItem, newItem);
          }
          return this.copyDir(oldItem, newItem);
        }),
      );
      return didCopyAll.every(b => b);
    } catch (err) {
      throw err;
    }
  }

  async exists(uri: NuclideUri): Promise<boolean> {
    try {
      await this._statPath(nuclideUri.getPath(uri));
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      } else {
        throw error;
      }
    }
  }

  async expandHomeDir(uri: string): Promise<string> {
    return this._client.expandHomeDir(uri);
  }

  async fstat(fd: number): Promise<fs.Stats> {
    const statData = await this._client.fstat(fd);
    return convertToFsFileStat(statData);
  }

  async fsync(fd: number): Promise<void> {
    return this._client.fsync(fd);
  }

  async ftruncate(fd: number, len: number): Promise<void> {
    return this._client.ftruncate(fd, len);
  }

  async lstat(uri: NuclideUri): Promise<fs.Stats> {
    try {
      const thriftFileStat = await this._client.lstat(nuclideUri.getPath(uri));
      return convertToFsFileStat(thriftFileStat);
    } catch (err) {
      throw err;
    }
  }

  async mkdir(uri: NuclideUri): Promise<void> {
    try {
      await this._client.createDirectory(nuclideUri.getPath(uri));
    } catch (err) {
      throw err;
    }
  }

  async mkdirp(uri: NuclideUri): Promise<boolean> {
    try {
      await this._client.mkdirp(nuclideUri.getPath(uri));
      return true;
    } catch (err) {
      logger.error(err);
      return false;
    }
  }

  /**
   * Moves all sourceUris into the specified destDir, assumed to be a directory name.
   */
  async move(
    sourceUris: Array<NuclideUri>,
    destDir: NuclideUri,
  ): Promise<void> {
    await Promise.all(
      sourceUris.map(uri => {
        const destUri = nuclideUri.join(destDir, nuclideUri.basename(uri));
        return this.rename(uri, destUri);
      }),
    );
  }

  async newFile(uri: NuclideUri): Promise<boolean> {
    try {
      const isExistingFile = await this.exists(uri);
      if (isExistingFile) {
        return false;
      }
      await this.mkdirp(nuclideUri.dirname(uri));
      await this.writeFile(uri, '');
      return true;
    } catch (err) {
      throw err;
    }
  }

  async open(
    uri: string,
    permissionFlags: number,
    mode: number,
  ): Promise<number> {
    const fd = await this._client.open(uri, permissionFlags, mode);
    return fd;
  }

  /**
   * Lists all children of the given directory.
   */
  async readdir(uri: NuclideUri): Promise<Array<DirectoryEntry>> {
    try {
      const entries = await this._client.readDirectory(nuclideUri.getPath(uri));
      return convertToFsDirectoryEntries(entries);
    } catch (err) {
      throw err;
    }
  }

  async rmdirAll(uris: Array<NuclideUri>): Promise<void> {
    await Promise.all(uris.map(uri => this.rmdir(uri)));
  }

  /**
   * Sorts the result of readdir() by alphabetical order (case-insensitive).
   */
  async readdirSorted(uri: NuclideUri): Promise<Array<DirectoryEntry>> {
    return (await this.readdir(uri)).sort((a, b) => {
      return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
    });
  }

  async readFile(uri: NuclideUri, options?: {flag?: string}): Promise<Buffer> {
    try {
      const path = nuclideUri.getPath(uri);
      return await this._client.readFile(path);
    } catch (err) {
      throw err;
    }
  }

  async realpath(uri: string): Promise<string> {
    return this._client.realpath(uri);
  }

  async resolveRealPath(uri: string): Promise<string> {
    return this._client.resolveRealPath(uri);
  }

  /**
   * Removes directories even if they are non-empty. Does not fail if the
   * directory doesn't exist.
   */
  async rmdir(uri: NuclideUri): Promise<void> {
    try {
      await this._client.deletePath(nuclideUri.getPath(uri), {
        recursive: true,
      });
    } catch (err) {
      throw err;
    }
  }

  /**
   * Runs the equivalent of `mv sourceUri destinationUri`.
   */
  async rename(
    sourceUri: NuclideUri,
    destinationUri: NuclideUri,
  ): Promise<void> {
    try {
      return this._client.rename(
        nuclideUri.getPath(sourceUri),
        nuclideUri.getPath(destinationUri),
        {
          overwrite: false,
        },
      );
    } catch (err) {
      throw err;
    }
  }

  async _statPath(path: string): Promise<fs.Stats> {
    const thriftFileStat = await this._client.stat(path);
    return convertToFsFileStat(thriftFileStat);
  }

  async stat(uri: NuclideUri): Promise<fs.Stats> {
    try {
      return await this._statPath(nuclideUri.getPath(uri));
    } catch (err) {
      throw err;
    }
  }

  /**
   * Removes files. Does not fail if the file doesn't exist.
   */
  async unlink(uri: NuclideUri): Promise<void> {
    try {
      await this._client.deletePath(nuclideUri.getPath(uri), {});
    } catch (error) {
      if (error.code !== filesystem_types.ErrorCode.ENOENT) {
        throw error;
      }
    }
  }

  async utimes(uri: string, atime: number, mtime: number): Promise<void> {
    return this._client.utimes(uri, atime, mtime);
  }

  async writeFile(
    uri: NuclideUri,
    content: string,
    options?: WriteOptions,
  ): Promise<void> {
    try {
      const data = new Buffer(content, BUFFER_ENCODING);
      await this.writeFileBuffer(uri, data, options);
    } catch (err) {
      throw err;
    }
  }

  async writeFileBuffer(
    uri: NuclideUri,
    data: Buffer,
    options?: WriteOptions,
  ): Promise<void> {
    try {
      const path = nuclideUri.getPath(uri);
      const writeOptions = options || {};
      await this._client.writeFile(path, data, writeOptions);
    } catch (err) {
      throw err;
    }
  }
}

export const SUPPORTED_THRIFT_RFS_FUNCTIONS: Set<string> = new Set(
  Object.getOwnPropertyNames(ThriftRfsClientAdapter.prototype).filter(
    i => !i.startsWith('_'),
  ),
);

export async function getOrCreateRfsClientAdapter(
  bigDigClient: BigDigClient,
): Promise<ThriftRfsClientAdapter> {
  const thriftClient = await getOrCreateThriftClient(bigDigClient);
  return getOrCreateAdapter(thriftClient);
}

const getOrCreateThriftClient = memoize(
  (bigDigClient: BigDigClient): Promise<ThriftClient> => {
    return bigDigClient.getOrCreateThriftClient(FS_SERVICE_CONFIG).then(
      thriftClient => {
        thriftClient.onUnexpectedClientFailure(() => {
          getOrCreateThriftClient.cache.delete(bigDigClient);
        });
        return thriftClient;
      },
      error => {
        getOrCreateThriftClient.cache.delete(bigDigClient);
        return Promise.reject(error);
      },
    );
  },
);

const getOrCreateAdapter = memoize(
  (thriftClient: ThriftClient): ThriftRfsClientAdapter => {
    thriftClient.onUnexpectedClientFailure(() => {
      getOrCreateAdapter.cache.delete(thriftClient);
    });
    return new ThriftRfsClientAdapter(thriftClient.getClient());
  },
);
