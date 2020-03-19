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

// need thrift flow type
import filesystem_types from './gen-nodejs/filesystem_types';

/**
 * This interface should always match filesystem.thrift
 */
export interface RemoteFileSystemClient {
  chmod(path: string, mode: number): Promise<void>;
  chown(path: string, uid: number, gid: number): Promise<void>;
  close(fd: number): Promise<void>;
  copy(
    source: string,
    destination: string,
    options: filesystem_types.CopyOpt,
  ): Promise<void>;
  createDirectory(path: string): Promise<void>;
  deletePath(uri: string, options: filesystem_types.DeleteOpt): Promise<void>;
  expandHomeDir(uri: string): Promise<string>;
  fsync(fd: number): Promise<void>;
  fstat(fd: number): Promise<filesystem_types.FileStat>;
  ftruncate(fd: number, len: number): Promise<void>;
  lstat(path: string): Promise<filesystem_types.FileStat>;
  mkdirp(uri: string): Promise<boolean>;
  open(path: string, permissionFlags: number, mode: number): Promise<number>;
  pollFileChanges(watchId: string): Promise<any>;
  readDirectory(uri: string): Promise<Array<filesystem_types.FileEntry>>;
  readFile(path: string): Promise<Buffer>;
  realpath(uri: string): Promise<string>;
  resolveRealPath(uri: string): Promise<string>;
  rename(
    oldUri: string,
    newUri: string,
    options: filesystem_types.RenameOpt,
  ): Promise<void>;

  stat(path: string): Promise<filesystem_types.FileStat>;
  unwatch(watchId: string): Promise<void>;
  utimes(path: string, atime: number, mtime: number): Promise<void>;
  watch(path: string, options: filesystem_types.WatchOpt): Promise<string>;
  writeFile(
    path: string,
    content: Buffer,
    options: filesystem_types.WriteFileOpt,
  ): Promise<void>;
}
