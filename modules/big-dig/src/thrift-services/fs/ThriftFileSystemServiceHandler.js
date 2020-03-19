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

import fs from 'fs';
import {arrayCompact} from 'nuclide-commons/collection';
import path from 'path';
import uuid from 'uuid';
import rimraf from 'rimraf';
import filesystem_types from './gen-nodejs/filesystem_types';
import fsPromise from 'nuclide-commons/fsPromise';
import {getLogger} from 'log4js';
import {WatchmanClient} from 'nuclide-watchman-helpers';
import {
  convertToThriftFileStat,
  genWatchExcludedExpressions,
  createThriftError,
  createThriftErrorWithCode,
  convertToThriftFileEntry,
} from './converter';
// eslint-disable-next-line nuclide-internal/prefer-nuclide-uri
import pathModule from 'path';
import os from 'os';

const commonWatchIgnoredExpressions = [
  ['not', ['dirname', '.hg']],
  ['not', ['match', 'hg-checkexec-*', 'wholename']],
  ['not', ['match', 'hg-checklink-*', 'wholename']],
  ['not', ['dirname', '.buckd']],
  ['not', ['dirname', '.idea']],
  ['not', ['dirname', '_build']],
  ['not', ['dirname', 'buck-cache']],
  ['not', ['dirname', 'buck-out']],
  ['not', ['dirname', '.fbbuild/generated']],
  ['not', ['match', '.fbbuild/generated*', 'wholename']],
  ['not', ['match', '_build-junk*', 'wholename']],
];

const logger = getLogger('fs-thrift-server-handler');
/**
 * Create a service handler class to manage server methods
 */
export class ThriftFileSystemServiceHandler {
  _fileChangeEvents: Array<filesystem_types.FileChangeEvent>;
  _watcher: WatchmanClient;
  _watchIdToChangeList: Map<string, Array<filesystem_types.FileChangeEvent>>;

  constructor(watcher: WatchmanClient) {
    this._fileChangeEvents = [];
    this._watcher = watcher;
    this._watchIdToChangeList = new Map();
  }

  async chmod(uri: string, mode: number): Promise<void> {
    try {
      return await fsPromise.chmod(uri, mode);
    } catch (err) {
      throw createThriftError(err);
    }
  }

  async chown(uri: string, uid: number, gid: number): Promise<void> {
    try {
      return await fsPromise.chown(uri, uid, gid);
    } catch (err) {
      throw createThriftError(err, {uri, uid, gid});
    }
  }

  async close(fd: number): Promise<void> {
    try {
      return await fsPromise.close(fd);
    } catch (err) {
      throw createThriftError(err, {fd});
    }
  }

  async copy(
    source: string,
    destination: string,
    options: filesystem_types.CopyOpt,
  ): Promise<void> {
    try {
      const {overwrite} = options;
      if (!overwrite && (await fsPromise.exists(destination))) {
        throw createThriftErrorWithCode(
          'EEXIST',
          filesystem_types.ErrorCode.EEXIST,
          {
            source,
            destination,
          },
        );
      }
      await fsPromise.copy(source, destination);
    } catch (err) {
      throw createThriftError(err, {source, destination, options});
    }
  }

  async createDirectory(uri: string): Promise<void> {
    try {
      return await fsPromise.mkdir(uri);
    } catch (err) {
      throw createThriftError(err, {uri});
    }
  }

  async deletePath(
    uri: string,
    options: filesystem_types.DeleteOpt,
  ): Promise<void> {
    try {
      if (options?.recursive) {
        return new Promise((resolve, reject) => {
          rimraf(uri, {disableGlobs: true}, (err, result) => {
            if (err == null) {
              resolve();
            } else {
              reject(createThriftError(err, {uri, options}));
            }
          });
        });
      } else {
        const stats = await fsPromise.lstat(uri);
        if (stats.isDirectory()) {
          await fsPromise.rmdir(uri);
        } else {
          await fsPromise.unlink(uri);
        }
      }
    } catch (err) {
      throw createThriftError(err, {uri, options});
    }
  }

  dispose(): void {
    for (const watchId of this._watchIdToChangeList.keys()) {
      this._watcher.unwatch(watchId);
    }
    this._watchIdToChangeList.clear();
  }

  async expandHomeDir(uri: string): Promise<string> {
    // Do not expand non home relative uris
    if (!uri.startsWith('~')) {
      return uri;
    }

    // "home" on Windows is %UserProfile%. Note that Windows environment variables
    // are NOT case sensitive, but process.env is a magic object that wraps GetEnvironmentVariableW
    // on Windows, so asking for any case is expected to work.
    const {HOME, UserProfile} = process.env;

    const isWindows = os.platform() === 'win32';
    const homePath = isWindows ? UserProfile : HOME;
    if (homePath == null) {
      throw createThriftError(
        {
          message: 'could not find path to home directory',
        },
        {uri},
      );
    }

    if (uri === '~') {
      return homePath;
    }

    // Uris like ~abc should not be expanded
    if (!uri.startsWith('~/') && (!isWindows || !uri.startsWith('~\\'))) {
      return uri;
    }

    return pathModule.resolve(homePath, uri.replace('~', '.'));
  }

  async fstat(fd: number): Promise<number> {
    try {
      const statData = await fsPromise.fstat(fd);
      return convertToThriftFileStat(statData);
    } catch (err) {
      throw createThriftError(err, {fd});
    }
  }
  async fsync(fd: number): Promise<void> {
    try {
      return await fsPromise.fsync(fd);
    } catch (err) {
      throw createThriftError(err, {fd});
    }
  }

  async ftruncate(fd: number, len: number): Promise<void> {
    try {
      return await fsPromise.ftruncate(fd, len);
    } catch (err) {
      throw createThriftError(err, {fd, len});
    }
  }

  async lstat(uri: string): Promise<filesystem_types.FileStat> {
    try {
      const statData = await fsPromise.lstat(uri);
      return convertToThriftFileStat(statData);
    } catch (err) {
      throw createThriftError(err, {uri});
    }
  }

  async mkdirp(uri: string): Promise<boolean> {
    try {
      return await fsPromise.mkdirp(uri);
    } catch (err) {
      throw createThriftError(err, {uri});
    }
  }

  async open(
    uri: string,
    permissionFlags: number,
    mode: number,
  ): Promise<number> {
    try {
      const fd = await fsPromise.open(uri, permissionFlags, mode);
      return fd;
    } catch (err) {
      throw createThriftError(err, {uri, permissionFlags, mode});
    }
  }

  pollFileChanges(watchId: string): Array<filesystem_types.FileChangeEvent> {
    const fileChangeList = this._watchIdToChangeList.get(watchId) || [];
    this._watchIdToChangeList.set(watchId, []);
    return fileChangeList;
  }

  async readDirectory(uri: string): Promise<Array<filesystem_types.FileEntry>> {
    try {
      const files: Array<string> = await fsPromise.readdir(uri);
      const entries = await Promise.all(
        files.map(async file => {
          const fullpath = path.join(uri, file);
          // lstat is the same as stat, but if path is a symbolic link, then
          // the link itself is stat-ed, not the file that it refers to
          const lstats = await this.lstat(fullpath);
          if (lstats.ftype !== filesystem_types.FileType.SYMLINK) {
            return convertToThriftFileEntry(file, lstats, false);
          }

          try {
            // try to return what the symlink points to (stat data)
            const stats = await this.stat(fullpath);
            return convertToThriftFileEntry(file, stats, true);
          } catch (error) {
            // symlink points to non-existent file/dir or cannot be read for
            // some reason
            return convertToThriftFileEntry(file, lstats, true);
          }
        }),
      );
      return arrayCompact(entries);
    } catch (err) {
      throw createThriftError(err, {uri});
    }
  }

  // Always returns a Buffer
  async readFile(uri: string): Promise<Buffer> {
    try {
      const contents = await fsPromise.readFile(uri);
      return contents;
    } catch (err) {
      throw createThriftError(err, {uri});
    }
  }

  async realpath(uri: string): Promise<string> {
    try {
      return await fsPromise.realpath(uri);
    } catch (err) {
      throw createThriftError(err, {uri});
    }
  }

  async resolveRealPath(uri: string): Promise<string> {
    try {
      const expandedHome = await this.expandHomeDir(uri);
      return await fsPromise.realpath(expandedHome);
    } catch (err) {
      throw createThriftError(err, {uri});
    }
  }

  async rename(
    oldUri: string,
    newUri: string,
    options: filesystem_types.RenameOpt,
  ): Promise<void> {
    try {
      await fsPromise.mv(oldUri, newUri, {clobber: options.overwrite});
    } catch (err) {
      throw createThriftError(err, {oldUri, newUri, options});
    }
  }

  async stat(uri: string): Promise<filesystem_types.FileStat> {
    try {
      const statData = await fsPromise.stat(uri);
      return convertToThriftFileStat(statData);
    } catch (err) {
      throw createThriftError(err, {uri});
    }
  }
  async unwatch(watchId: string): Promise<void> {
    try {
      await this._watcher.unwatch(watchId);
    } catch (err) {
      throw createThriftError(err, {watchId});
    }
  }
  async utimes(uri: string, atime: number, mtime: number): Promise<void> {
    try {
      return await fsPromise.utimes(uri, atime, mtime);
    } catch (err) {
      throw createThriftError(err, {uri, atime, mtime});
    }
  }

  async watch(
    uri: string,
    options: filesystem_types.WatchOpt,
  ): Promise<string> {
    const {recursive, excludes} = options;

    const excludeExpr = genWatchExcludedExpressions(excludes);
    if (!recursive) {
      // Do not match files in subdirectories:
      excludeExpr.push(['not', ['dirname', '', ['depth', 'ge', 2]]]);
    }
    const opts = {
      expression: ['allof', ...commonWatchIgnoredExpressions, ...excludeExpr],
    };

    logger.info(`Watching ${uri} ${JSON.stringify(opts)}`);
    const watchId = `big-dig-thrift-filewatcher-${uuid.v4()}`;
    try {
      const sub = await this._watcher.watchDirectoryRecursive(
        uri,
        watchId,
        opts,
      );

      sub.on('error', error => {
        logger.error(
          `Watchman Subscription Error: big-dig-thrift-filewatcher-${uri}`,
        );
        logger.error(error);
      });
      sub.on('change', entries => {
        const changes = entries.map(
          (entry): filesystem_types.FileChangeEvent => {
            if (!entry.exists) {
              return {
                fname: entry.name,
                eventType: filesystem_types.FileChangeEventType.DELETE,
              };
            } else if (entry.new) {
              return {
                fname: entry.name,
                eventType: filesystem_types.FileChangeEventType.ADD,
              };
            } else {
              return {
                fname: entry.name,
                eventType: filesystem_types.FileChangeEventType.UPDATE,
              };
            }
          },
        );
        // Add new changes into the list of file changes
        const fileChangeList = this._watchIdToChangeList.get(watchId) || [];
        fileChangeList.push(...changes);
        this._watchIdToChangeList.set(watchId, fileChangeList);
      });
    } catch (err) {
      logger.error(
        'BigDig Thrift FS Server Watchman Subscription Creation Error',
      );
      logger.error(err);
    }
    return watchId;
  }

  async writeFile(
    uri: string,
    content: Buffer,
    options: filesystem_types.WriteFileOpt,
  ): Promise<void> {
    try {
      let writeOptions = {};
      if (
        options.encoding != null ||
        options.mode != null ||
        options.flag != null
      ) {
        // used in Nuclide
        writeOptions.encoding = options.encoding;
        writeOptions.mode = options.mode;
        writeOptions.flag = options.flag;
      } else {
        // used in VSCode
        const flags = [
          fs.constants.O_WRONLY,
          fs.constants.O_TRUNC,
          options.create ? fs.constants.O_CREAT : 0,
          options.overwrite || !options.create ? 0 : fs.constants.O_EXCL,
        ] // eslint-disable-next-line no-bitwise
          .reduce((acc, f) => acc | f, 0);
        writeOptions = {flags};
      }

      await fsPromise.writeFile(uri, content, writeOptions);
    } catch (err) {
      throw createThriftError(err, {uri, options});
    }
  }
}
