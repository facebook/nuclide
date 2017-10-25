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

// This exists to break the cycle between ArchiveFile,
// ArchiveDirectory, and ArchiveFileAsDirectory

import type {ConnectableObservable} from 'rxjs';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {DirectoryEntry, ReadOptions, WriteOptions} from '../../nuclide-fs';

import fs from 'fs';
import {FileSystem} from '../../nuclide-fs';
import {ArchiveFile} from './ArchiveFile';
import {ArchiveFileAsDirectory} from './ArchiveFileAsDirectory';
import {ArchiveDirectory} from './ArchiveDirectory';

export class ArchiveFileSystem implements FileSystem {
  _fs: FileSystem;

  constructor(fileSystem: FileSystem) {
    this._fs = fileSystem;
  }

  newArchiveFile(path: NuclideUri): ArchiveFile {
    return new ArchiveFile(path, this);
  }

  newArchiveFileAsDirectory(path: NuclideUri): ArchiveFileAsDirectory {
    return new ArchiveFileAsDirectory(path, this);
  }

  newArchiveDirectory(path: NuclideUri): ArchiveDirectory {
    return new ArchiveDirectory(path, this);
  }

  exists(path: NuclideUri): Promise<boolean> {
    return this._fs.exists(path);
  }

  findNearestFile(name: string, directory: NuclideUri): Promise<?NuclideUri> {
    return this._fs.findNearestFile(name, directory);
  }

  stat(path: NuclideUri): Promise<fs.Stats> {
    return this._fs.stat(path);
  }

  lstat(path: NuclideUri): Promise<fs.Stats> {
    return this._fs.lstat(path);
  }

  mkdir(path: NuclideUri): Promise<void> {
    return this._fs.mkdir(path);
  }

  mkdirp(path: NuclideUri): Promise<boolean> {
    return this._fs.mkdirp(path);
  }

  chmod(path: NuclideUri, mode: number): Promise<void> {
    return this._fs.chmod(path, mode);
  }

  chown(path: NuclideUri, uid: number, gid: number): Promise<void> {
    return this._fs.chown(path, uid, gid);
  }

  newFile(path: NuclideUri): Promise<boolean> {
    return this._fs.newFile(path);
  }

  readdir(path: NuclideUri): Promise<Array<DirectoryEntry>> {
    return this._fs.readdir(path);
  }

  realpath(path: NuclideUri): Promise<NuclideUri> {
    return this._fs.realpath(path);
  }

  move(from: NuclideUri, to: NuclideUri): Promise<void> {
    return this._fs.move(from, to);
  }

  copy(from: NuclideUri, to: NuclideUri): Promise<void> {
    return this._fs.copy(from, to);
  }

  rimraf(path: NuclideUri): Promise<void> {
    return this._fs.rimraf(path);
  }

  unlink(path: NuclideUri): Promise<void> {
    return this._fs.unlink(path);
  }

  readFile(path: NuclideUri, options?: ReadOptions): Promise<Buffer> {
    return this._fs.readFile(path, options);
  }

  createReadStream(
    path: NuclideUri,
    options?: ReadOptions,
  ): ConnectableObservable<Buffer> {
    return this._fs.createReadStream(path, options);
  }

  writeFile(
    path: NuclideUri,
    data: string,
    options?: WriteOptions,
  ): Promise<void> {
    return this._fs.writeFile(path, data, options);
  }

  isNfs(path: NuclideUri): Promise<boolean> {
    return this._fs.isNfs(path);
  }

  isFuse(path: NuclideUri): Promise<boolean> {
    return this._fs.isFuse(path);
  }

  openArchive(path: NuclideUri): Promise<FileSystem> {
    return this._fs.openArchive(path);
  }
}
